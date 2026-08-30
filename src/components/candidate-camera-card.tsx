"use client";

import { useEffect, useRef, useState } from "react";

export function CandidateCameraCard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState("");

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("当前浏览器不支持摄像头预览");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsActive(true);
    } catch {
      setError("未获得摄像头权限");
    }
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <section className="candidate-camera-card">
      <div className="candidate-camera-visual">
        <video
          aria-label="候选人摄像头本地预览"
          autoPlay
          className={isActive ? "candidate-camera-feed is-active" : "candidate-camera-feed"}
          muted
          playsInline
          ref={videoRef}
        />
        {!isActive && (
          <div className="candidate-camera-empty">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M14.5 7.5h-9A2.5 2.5 0 0 0 3 10v4a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 17 14v-4a2.5 2.5 0 0 0-2.5-2.5Z" />
              <path d="m17 10.3 3.1-1.8a.6.6 0 0 1 .9.5v6a.6.6 0 0 1-.9.5L17 13.7" />
            </svg>
            <strong>{error || "摄像头未开启"}</strong>
            <span>画面仅在本地预览</span>
          </div>
        )}
      </div>
      <div className="candidate-camera-meta">
        <div>
          <p>候选人</p>
          <h2>你</h2>
        </div>
        <button
          className={isActive ? "camera-toggle is-active" : "camera-toggle"}
          onClick={isActive ? stopCamera : () => void startCamera()}
          type="button"
        >
          <i />
          {isActive ? "关闭摄像头" : "开启摄像头"}
        </button>
      </div>
    </section>
  );
}
