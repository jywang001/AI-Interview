type PresenterState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "followup";

const stateCopy: Record<PresenterState, string> = {
  idle: "等待开始",
  listening: "正在聆听",
  thinking: "正在整理追问",
  speaking: "面试官提问中",
  followup: "正在深入追问",
};

const stateVideo: Record<PresenterState, string> = {
  idle: "/interviewers/idle.mp4",
  listening: "/interviewers/listening.mp4",
  thinking: "/interviewers/thinking.mp4",
  speaking: "/interviewers/speaking.mp4",
  followup: "/interviewers/followup.mp4",
};

type PresenterCardProps = {
  state: PresenterState;
  compact?: boolean;
};

export function PresenterCard({ state, compact = false }: PresenterCardProps) {
  return (
    <section className={compact ? "presenter-card is-compact" : "presenter-card"}>
      <div className="presenter-visual">
        <div className="signal-ring" aria-hidden="true" />
        <video
          aria-label={`AI 面试官${stateCopy[state]}`}
          autoPlay
          className="presenter-media"
          loop
          muted
          playsInline
          poster="/interviewers/poster.jpg"
          preload="auto"
          src={stateVideo[state]}
        />
      </div>
      <div className="presenter-meta">
        <div>
          <p>面试官</p>
          <h2>林序</h2>
        </div>
        <span className={"presenter-state state-" + state}>
          <i />
          {stateCopy[state]}
        </span>
      </div>
      {!compact && (
        <p className="presenter-note">
          将根据你的回答自然追问，并在合适时进入下一阶段。
        </p>
      )}
    </section>
  );
}
