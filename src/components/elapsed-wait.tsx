"use client";

import { useEffect, useState } from "react";
import styles from "./elapsed-wait.module.css";

type ElapsedWaitProps = Readonly<{
  active: boolean;
  label: string;
  timeoutSeconds?: number;
  compact?: boolean;
}>;

function waitHint(elapsedSeconds: number, timeoutSeconds?: number) {
  if (timeoutSeconds && elapsedSeconds >= Math.max(10, timeoutSeconds - 10)) {
    return "即将达到等待上限，超时后可以直接重试";
  }
  if (elapsedSeconds >= 15) return "模型仍在处理，请保持当前页面开启";
  if (elapsedSeconds >= 5) return "正在处理较完整的上下文";
  return "请求已提交，请稍候";
}

export function ElapsedWait({
  active,
  label,
  timeoutSeconds,
  compact = false,
}: ElapsedWaitProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setElapsedSeconds(0);
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const progress = timeoutSeconds
    ? Math.min(96, Math.max(4, (elapsedSeconds / timeoutSeconds) * 100))
    : Math.min(92, 8 + elapsedSeconds * 2);

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={`${styles.wait} ${compact ? styles.compact : ""}`}
      role="status"
    >
      <span aria-hidden="true" className={styles.spinner} />
      <div className={styles.copy}>
        <strong>{label}</strong>
        <small>
          已等待 {elapsedSeconds} 秒 · {waitHint(elapsedSeconds, timeoutSeconds)}
        </small>
        <i aria-hidden="true" className={styles.track}>
          <i style={{ width: `${progress}%` }} />
        </i>
      </div>
    </div>
  );
}
