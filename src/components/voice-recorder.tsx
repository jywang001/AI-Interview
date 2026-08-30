"use client";

import { useEffect, useRef, useState } from "react";
import { ElapsedWait } from "@/components/elapsed-wait";
import { convertRecordedAudioToWav } from "@/lib/speech/wav.client";

const MAX_RECORDING_SECONDS = 120;
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
  answerEnabled?: boolean;
  speakerOnly?: boolean;
  onQuestionPlaybackEnded?: () => void;
  onQuestionPlaybackStateChange?: (isPlaying: boolean) => void;
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

function waitForMediaSourceOpen(mediaSource: MediaSource) {
  if (mediaSource.readyState === "open") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleClose = () => {
      cleanup();
      reject(new Error("MEDIA_SOURCE_CLOSED"));
    };
    const cleanup = () => {
      mediaSource.removeEventListener("sourceopen", handleOpen);
      mediaSource.removeEventListener("sourceclose", handleClose);
    };

    mediaSource.addEventListener("sourceopen", handleOpen, { once: true });
    mediaSource.addEventListener("sourceclose", handleClose, { once: true });
  });
}

function appendAudioChunk(sourceBuffer: SourceBuffer, chunk: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    const handleUpdateEnd = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("SOURCE_BUFFER_ERROR"));
    };
    const cleanup = () => {
      sourceBuffer.removeEventListener("updateend", handleUpdateEnd);
      sourceBuffer.removeEventListener("error", handleError);
    };

    sourceBuffer.addEventListener("updateend", handleUpdateEnd, { once: true });
    sourceBuffer.addEventListener("error", handleError, { once: true });
    try {
      const ownedChunk = new Uint8Array(chunk.byteLength);
      ownedChunk.set(chunk);
      sourceBuffer.appendBuffer(ownedChunk);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function VoiceRecorder({
  question,
  initialTranscript,
  onConfirm,
  answerEnabled = true,
  speakerOnly = false,
  onQuestionPlaybackEnded,
  onQuestionPlaybackStateChange,
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
  const synthesisControllerRef = useRef<AbortController | null>(null);
  const playbackCompletionNotifiedRef = useRef(false);
  const automaticRecordingStartedRef = useRef(false);
  const recordingRequestInFlightRef = useRef(false);

  function notifyQuestionPlaybackEnded() {
    if (playbackCompletionNotifiedRef.current) return;
    playbackCompletionNotifiedRef.current = true;
    onQuestionPlaybackEnded?.();
  }

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
      synthesisControllerRef.current?.abort();
      questionAudioRef.current?.pause();
      onQuestionPlaybackStateChange?.(false);
      if (questionAudioUrlRef.current) {
        URL.revokeObjectURL(questionAudioUrlRef.current);
      }
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
    if (
      recordingRequestInFlightRef.current ||
      recorderRef.current?.state === "recording"
    ) {
      return;
    }

    automaticRecordingStartedRef.current = true;
    recordingRequestInFlightRef.current = true;
    setError("");
    setSubmitted(false);
    setTranscriptionProvider("");
    setRawSttText(null);
    synthesisControllerRef.current?.abort();
    synthesisControllerRef.current = null;
    questionAudioRef.current?.pause();

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      recordingRequestInFlightRef.current = false;
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
    } finally {
      recordingRequestInFlightRef.current = false;
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function replaceQuestionAudio(audio: HTMLAudioElement, url: string) {
    questionAudioRef.current?.pause();
    if (questionAudioUrlRef.current) {
      URL.revokeObjectURL(questionAudioUrlRef.current);
    }

    questionAudioRef.current = audio;
    questionAudioUrlRef.current = url;
    audio.addEventListener(
      "playing",
      () => onQuestionPlaybackStateChange?.(true),
      { once: true },
    );
    audio.addEventListener("pause", () => onQuestionPlaybackStateChange?.(false));
    audio.addEventListener("error", () => onQuestionPlaybackStateChange?.(false));
    audio.addEventListener(
      "ended",
      () => {
        onQuestionPlaybackStateChange?.(false);
        URL.revokeObjectURL(url);
        if (questionAudioUrlRef.current === url) {
          questionAudioUrlRef.current = "";
        }
        notifyQuestionPlaybackEnded();
        if (
          answerEnabled &&
          !speakerOnly &&
          !automaticRecordingStartedRef.current
        ) {
          void startRecording();
        }
      },
      { once: true },
    );
  }

  async function playBufferedRemoteAudio(response: Response) {
    const audioBlob = await response.blob();
    if (!audioBlob.type.startsWith("audio/") || audioBlob.size === 0) {
      throw new Error("SYNTHESIS_INVALID_AUDIO");
    }

    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    replaceQuestionAudio(audio, url);
    await audio.play();
  }

  async function playStreamingRemoteAudio(response: Response) {
    if (
      !response.body ||
      !("MediaSource" in window) ||
      !MediaSource.isTypeSupported("audio/mpeg")
    ) {
      await playBufferedRemoteAudio(response);
      return;
    }

    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    const audio = new Audio(url);
    audio.preload = "auto";
    replaceQuestionAudio(audio, url);

    await waitForMediaSourceOpen(mediaSource);
    const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
    const reader = response.body.getReader();
    let receivedAudio = false;
    let playbackStarted = false;
    let playbackAttempt: Promise<void> | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength === 0) continue;

        await appendAudioChunk(sourceBuffer, value);
        receivedAudio = true;

        if (!playbackAttempt) {
          playbackAttempt = audio
            .play()
            .then(() => {
              playbackStarted = true;
            })
            .catch(() => undefined);
        }
      }

      if (!receivedAudio) {
        throw new Error("SYNTHESIS_EMPTY_AUDIO");
      }
      if (sourceBuffer.updating) {
        await new Promise<void>((resolve) => {
          sourceBuffer.addEventListener("updateend", () => resolve(), {
            once: true,
          });
        });
      }
      if (mediaSource.readyState === "open") {
        mediaSource.endOfStream();
      }

      await playbackAttempt;
      if (!playbackStarted) {
        await audio.play();
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      if (mediaSource.readyState === "open") {
        try {
          mediaSource.endOfStream("decode");
        } catch {
          // The media source may already be closing after a decoder error.
        }
      }
      throw error;
    }
  }

  async function speakQuestion() {
    if (synthesisControllerRef.current) return;

    setError("");
    questionAudioRef.current?.pause();
    const controller = new AbortController();
    synthesisControllerRef.current = controller;
    let timedOut = false;
    const timeout = setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
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

      await playStreamingRemoteAudio(response);
    } catch {
      onQuestionPlaybackStateChange?.(false);
      if (!controller.signal.aborted || timedOut) {
        setError(
          timedOut
            ? "面试官语音生成超时，请点击播放问题重试。"
            : "远端语音播放失败，请点击播放问题重试。",
        );
      }
      notifyQuestionPlaybackEnded();
    } finally {
      clearTimeout(timeout);
      if (synthesisControllerRef.current === controller) {
        synthesisControllerRef.current = null;
        setIsSynthesizing(false);
      }
    }
  }

  useEffect(() => {
    if (!question.trim()) return;

    const timer = window.setTimeout(() => {
      void speakQuestion();
    }, 0);

    return () => window.clearTimeout(timer);
    // A new keyed recorder is mounted for every interview turn; question is
    // the only trigger we intentionally want for automatic playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  async function submitAnswer() {
    const confirmedAnswerText = transcript.trim();
    if (confirmedAnswerText.length < 2 || isSubmitting) return;

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
          {isSynthesizing
            ? "生成语音中…"
            : speakerOnly
              ? "播放结束语"
              : "播放问题"}
        </button>
        {answerEnabled && state !== "recording" ? (
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
        ) : answerEnabled ? (
          <button
            className="record-button is-recording"
            onClick={stopRecording}
            type="button"
          >
            <i />
            回答完毕 · {recordingSeconds}s
          </button>
        ) : null}
        <span className="privacy-copy">
          {speakerOnly
            ? "面试结束语由 AI 生成"
            : answerEnabled
              ? "问题播报结束后自动录音 · 最长 120 秒 · 原始音频不落盘"
              : "面试官正在读题；播报结束后开始独立思考"}
        </span>
      </div>

      <ElapsedWait
        active={isSynthesizing}
        compact
        label="正在生成面试官语音"
        timeoutSeconds={SYNTHESIS_TIMEOUT_MS / 1_000}
      />
      {answerEnabled && (
        <>
          <ElapsedWait
            active={state === "transcribing"}
            compact
            label="正在把录音转成可编辑文字"
            timeoutSeconds={TRANSCRIPTION_TIMEOUT_MS / 1_000}
          />
          <ElapsedWait
            active={isSubmitting}
            compact
            label="面试官正在判断回答并组织下一题"
            timeoutSeconds={45}
          />
        </>
      )}

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      {answerEnabled && transcriptionProvider && (
        <p className="success-note" role="status">
          已由 {transcriptionProvider} 生成草稿，请核对技术名词后再提交。
        </p>
      )}

      {answerEnabled && audioUrl && (
        <audio className="audio-preview" controls src={audioUrl}>
          你的浏览器不支持音频预览。
        </audio>
      )}

      {answerEnabled && (
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
      )}

      {answerEnabled && (
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
              transcript.trim().length < 2
            }
            onClick={() => void submitAnswer()}
            type="button"
          >
            {isSubmitting ? "面试官思考中…" : "确认并提交本轮"}
            <span>→</span>
          </button>
        </div>
      )}

      {answerEnabled && submitted && (
        <p className="success-note" role="status">
          {onConfirm
            ? "当前确认版回答已提交。"
            : "当前确认版文字已就绪；动态追问 API 正在接入，暂未写入正式会话。"}
        </p>
      )}
    </section>
  );
}
