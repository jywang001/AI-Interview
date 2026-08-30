"use client";

import { useEffect, useRef, useState } from "react";
import { convertRecordedAudioToWav } from "@/lib/speech/wav.client";

const MAX_RECORDING_SECONDS = 60;
const TRANSCRIPTION_TIMEOUT_MS = 45_000;
const SYNTHESIS_TIMEOUT_MS = 20_000;

type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "ready";

type VoiceRecorderProps = {
  question: string;
  initialTranscript: string;
  onConfirm?: (answer: ConfirmedAnswer) => Promise<void> | void;
};

export type ConfirmedAnswer = Readonly<{
  answerSource: "voice" | "text";
  rawSttText: string | null;
  confirmedAnswerText: string;
}>;

type TranscriptionPayload = {
  ok?: boolean;
  rawText?: string;
  provider?: string;
  message?: string;
};

function chooseRecorderMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `speech-${Date.now()}`;
}

export function VoiceRecorder({
  question,
  initialTranscript,
  onConfirm,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [transcript, setTranscript] = useState(initialTranscript);
  const [submitted, setSubmitted] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcriptionProvider, setTranscriptionProvider] = useState("");
  const [rawSttText, setRawSttText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);
  const questionAudioUrlRef = useRef("");

  function clearRecordingTimers() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    stopTimerRef.current = null;
    tickTimerRef.current = null;
  }

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      questionAudioRef.current?.pause();
      if (questionAudioUrlRef.current) {
        URL.revokeObjectURL(questionAudioUrlRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function transcribeRecording(recording: Blob) {
    setState("transcribing");
    setTranscriptionProvider("");
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TRANSCRIPTION_TIMEOUT_MS,
    );

    try {
      const wav = await convertRecordedAudioToWav(recording);
      const formData = new FormData();
      formData.append("audio", wav, "interview-answer.wav");
      formData.append("locale", "zh-CN");
      formData.append("requestId", createRequestId());

      const response = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: formData,
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as TranscriptionPayload;
      const rawText = payload.rawText?.trim();

      if (!response.ok || !rawText) {
        throw new Error(payload.message || "TRANSCRIPTION_FAILED");
      }

      setTranscript(rawText);
      setRawSttText(rawText);
      setTranscriptionProvider(payload.provider || "豆包语音");
      setSubmitted(false);
      setState("ready");
    } catch (reason) {
      setState("ready");
      setError(
        reason instanceof DOMException && reason.name === "AbortError"
          ? "转写等待超时。录音仍可播放，请直接编辑文字回答。"
          : "本次语音转写失败。录音仍可播放，请重试或直接编辑文字。",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async function handleRecordingStopped(recorder: MediaRecorder) {
    clearRecordingTimers();
    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (blob.size === 0) {
      setState("idle");
      setError("没有收到有效录音，请检查麦克风后重试。");
      return;
    }

    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(blob);
    });
    await transcribeRecording(blob);
  }

  async function startRecording() {
    setError("");
    setSubmitted(false);
    setTranscriptionProvider("");
    setRawSttText(null);
    questionAudioRef.current?.pause();
    window.speechSynthesis?.cancel();

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("当前浏览器不支持录音，请直接使用文字回答。");
      return;
    }

    try {
      setState("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mimeType = chooseRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      setRecordingSeconds(0);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        void handleRecordingStopped(recorder);
      });
      recorder.addEventListener("error", () => {
        clearRecordingTimers();
        stream.getTracks().forEach((track) => track.stop());
        setState("idle");
        setError("录音过程出现异常，请重试或使用文字回答。");
      });

      recorder.start(1_000);
      setState("recording");
      tickTimerRef.current = setInterval(
        () => setRecordingSeconds((seconds) => seconds + 1),
        1_000,
      );
      stopTimerRef.current = setTimeout(
        () => recorder.state === "recording" && recorder.stop(),
        MAX_RECORDING_SECONDS * 1_000,
      );
    } catch {
      setState("idle");
      setError("无法访问麦克风。你可以检查权限，或继续使用文字回答。");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function speakQuestionWithBrowser() {
    if (!("speechSynthesis" in window)) {
      setError("当前浏览器不支持朗读，题目文字仍可正常使用。");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  }

  async function speakQuestion() {
    if (isSynthesizing) return;

    setError("");
    questionAudioRef.current?.pause();
    window.speechSynthesis?.cancel();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SYNTHESIS_TIMEOUT_MS,
    );
    setIsSynthesizing(true);

    try {
      const response = await fetch("/api/speech/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: createRequestId(),
          text: question,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("SYNTHESIS_UNAVAILABLE");

      const audioBlob = await response.blob();
      if (!audioBlob.type.startsWith("audio/") || audioBlob.size === 0) {
        throw new Error("SYNTHESIS_INVALID_AUDIO");
      }

      if (questionAudioUrlRef.current) {
        URL.revokeObjectURL(questionAudioUrlRef.current);
      }
      const url = URL.createObjectURL(audioBlob);
      questionAudioUrlRef.current = url;
      const audio = new Audio(url);
      questionAudioRef.current = audio;
      audio.addEventListener(
        "ended",
        () => {
          URL.revokeObjectURL(url);
          if (questionAudioUrlRef.current === url) {
            questionAudioUrlRef.current = "";
          }
        },
        { once: true },
      );
      await audio.play();
    } catch {
      speakQuestionWithBrowser();
    } finally {
      clearTimeout(timeout);
      setIsSynthesizing(false);
    }
  }

  async function submitAnswer() {
    const confirmedAnswerText = transcript.trim();
    if (confirmedAnswerText.length < 10 || isSubmitting) return;

    setError("");
    setIsSubmitting(true);
    try {
      await onConfirm?.({
        answerSource: rawSttText === null ? "text" : "voice",
        rawSttText,
        confirmedAnswerText,
      });
      setSubmitted(true);
    } catch {
      setError("提交本轮回答失败，确认文字仍保留，请稍后重试。");
      setSubmitted(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  const recordingBusy =
    state === "requesting" || state === "recording" || state === "transcribing";

  return (
    <section className="answer-console">
      <div className="recorder-toolbar">
        <button
          className="audio-button"
          disabled={isSynthesizing}
          onClick={() => void speakQuestion()}
          type="button"
        >
          {isSynthesizing ? "生成语音中…" : "播放问题"}
        </button>
        {state !== "recording" ? (
          <button
            className="record-button"
            disabled={recordingBusy}
            onClick={() => void startRecording()}
            type="button"
          >
            <i />
            {state === "requesting"
              ? "等待麦克风权限…"
              : state === "transcribing"
                ? "豆包语音转写中…"
                : "开始语音回答"}
          </button>
        ) : (
          <button
            className="record-button is-recording"
            onClick={stopRecording}
            type="button"
          >
            <i />
            回答完毕 · {recordingSeconds}s
          </button>
        )}
        <span className="privacy-copy">
          问题语音由 AI 生成 · 最长录音 60 秒 · 原始音频不落盘
        </span>
      </div>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      {transcriptionProvider && (
        <p className="success-note" role="status">
          已由 {transcriptionProvider} 生成草稿，请核对技术名词后再提交。
        </p>
      )}

      {audioUrl && (
        <audio className="audio-preview" controls src={audioUrl}>
          你的浏览器不支持音频预览。
        </audio>
      )}

      <label className="transcript-editor">
        <span>
          回答转写
          <small>
            {state === "transcribing"
              ? "正在识别，请稍候…"
              : "只有你确认后的文字才会交给面试官和 Coach"}
          </small>
        </span>
        <textarea
          disabled={state === "transcribing"}
          onChange={(event) => {
            setTranscript(event.target.value);
            setSubmitted(false);
          }}
          value={transcript}
        />
      </label>

      <div className="answer-actions">
        <button
          className="button button-ghost"
          disabled={state === "transcribing"}
          onClick={() => setTranscript("")}
          type="button"
        >
          清空文字
        </button>
        <button
          className="button button-primary"
          disabled={
            state === "transcribing" ||
            isSubmitting ||
            transcript.trim().length < 10
          }
          onClick={() => void submitAnswer()}
          type="button"
        >
          {isSubmitting ? "面试官思考中…" : "确认并提交本轮"}
          <span>→</span>
        </button>
      </div>

      {submitted && (
        <p className="success-note" role="status">
          {onConfirm
            ? "当前确认版回答已提交。"
            : "当前确认版文字已就绪；动态追问 API 正在接入，暂未写入正式会话。"}
        </p>
      )}
    </section>
  );
}
