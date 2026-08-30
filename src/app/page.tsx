import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell active="home">
      <main className="home-page home-simple">
        <section className="simple-hero">
          <div className="simple-hero-copy">
            <h1>技术面试练习</h1>
            <p>
              选择 AI 算法岗或 AI 应用开发岗，上传简历与 JD，完成一场六阶段模拟面试。结束后可以查看评分、逐阶段点评和完整对话。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" href="/prepare">
                开始面试
                <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-secondary button-large" href="/reports">
                查看复盘示例
              </Link>
            </div>
          </div>

          <div className="simple-preview" aria-label="模拟面试界面预览">
            <div className="simple-preview-head">
              <span><i /> 面试进行中</span>
              <span>项目深挖 · 2 / 6</span>
            </div>
            <div className="simple-preview-person">
              <div className="preview-avatar" aria-hidden="true">林</div>
              <div>
                <strong>面试官 · 林序</strong>
                <small>根据上一轮回答继续追问</small>
              </div>
            </div>
            <blockquote>
              你提到把 P95 延迟从 4.8 秒降到了 2.6 秒。这个优化里，哪一部分是你亲自完成的？
            </blockquote>
            <div className="simple-answer-bar">
              <span>点击麦克风开始回答</span>
              <i aria-hidden="true">●</i>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
