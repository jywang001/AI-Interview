"use client";

import { useEffect, useRef, useState } from "react";

type RecorderState = "idle" | "requesting" | "recording" | "ready";

type VoiceRecorderProps = {
  question: string;
  initialTranscript: string;
};

export function VoiceRecorder({
  question,
  initialTranscript,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [transcript, setTranscript] = useState(initialTranscript);
  const [submitted, setSubmitted] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function startRecording() {
    setError("");
    setSubmitted(false);

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("当前浏览器不支持录音，请直接使用文字回答。");
      return;
    }

    try {
      setState("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
        stream.getTracks().forEach((track) => track.stop());
        setState("ready");
      });

      recorder.start();
      setState("recording");
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

  function speakQuestion() {
    if (!("speechSynthesis" in window)) {
      setError("当前浏览器不支持朗读，题目文字仍可正常使用。");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  }

  return (
    <section className="answer-console">
      <div className="recorder-toolbar">
        <button className="audio-button" onClick={speakQuestion} type="button">
          播放问题
        </button>
        {state !== "recording" ? (
          <button
            className="record-button"
            disabled={state === "requesting"}
            onClick={() => void startRecording()}
            type="button"
          >
            <i />
            {state === "requesting" ? "等待麦克风权限…" : "开始语音回答"}
          </button>
        ) : (
          <button className="record-button is-recording" onClick={stopRecording} type="button">
            <i />
            回答完毕
          </button>
        )}
        <span className="privacy-copy">音频仅保存在当前浏览器内存</span>
      </div>

      {error && (
        <p className="inline-error" role="alert">
          {error}
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
          <small>框架阶段提供可编辑文本；STT Provider 将在下一步接入</small>
        </span>
        <textarea
          onChange={(event) => {
            setTranscript(event.target.value);
            setSubmitted(false);
          }}
          value={transcript}
        />
      </label>

      <div className="answer-actions">
        <button className="button button-ghost" onClick={() => setTranscript("")} type="button">
          清空文字
        </button>
        <button
          className="button button-primary"
          disabled={transcript.trim().length < 10}
          onClick={() => setSubmitted(true)}
          type="button"
        >
          提交本轮回答
          <span>→</span>
        </button>
      </div>

      {submitted && (
        <p className="success-note" role="status">
          交互骨架已收到当前文字；本提交尚未持久化回答，也尚未调用动态追问 API。
        </p>
      )}
    </section>
  );
}
