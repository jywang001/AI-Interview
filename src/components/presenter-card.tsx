import Image from "next/image";

type PresenterState = "idle" | "listening" | "thinking" | "speaking";

const stateCopy: Record<PresenterState, string> = {
  idle: "等待开始",
  listening: "正在聆听",
  thinking: "正在整理追问",
  speaking: "面试官提问中",
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
        <Image
          alt="原创抽象面试官形象"
          height={360}
          priority
          src="/presenter-placeholder.svg"
          width={360}
        />
      </div>
      <div className="presenter-meta">
        <div>
          <p>AI INTERVIEWER · 01</p>
          <h2>林序</h2>
        </div>
        <span className={"presenter-state state-" + state}>
          <i />
          {stateCopy[state]}
        </span>
      </div>
      {!compact && (
        <p className="presenter-note">
          专注项目证据与工程权衡。Presenter 可替换，面试状态与视觉渲染相互独立。
        </p>
      )}
    </section>
  );
}
