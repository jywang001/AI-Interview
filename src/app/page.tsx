import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const interviewStages = [
  "自我介绍",
  "简历项目深挖",
  "岗位知识",
  "算法思路",
  "动机与到岗",
  "候选人反问",
] as const;

export default function Home() {
  return (
    <AppShell active="home">
      <main className="home-page home-simple">
        <section className="simple-hero">
          <div className="simple-hero-copy">
            <h1>AI 模拟面试官</h1>
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
            <dl className="home-hero-facts">
              <div>
                <dt>支持岗位</dt>
                <dd>
                  <span>AI 算法岗</span>
                  <span>AI 应用开发岗</span>
                </dd>
              </div>
              <div>
                <dt>回答方式</dt>
                <dd>
                  <span>语音回答</span>
                  <span>文字回答</span>
                </dd>
              </div>
            </dl>
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

        <section className="home-process" aria-labelledby="home-process-title">
          <header>
            <div>
              <p className="eyebrow">面试流程</p>
              <h2 id="home-process-title">六阶段完整面试</h2>
            </div>
          </header>
          <ol>
            {interviewStages.map((stage, index) => (
              <li key={stage}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-outcomes" aria-labelledby="home-outcomes-title">
          <header>
            <p className="eyebrow">复盘结果</p>
            <h2 id="home-outcomes-title">面试结束后</h2>
          </header>
          <ul>
            <li><span>01</span><strong>综合得分与是否通过</strong></li>
            <li><span>02</span><strong>七项能力评分</strong></li>
            <li><span>03</span><strong>逐阶段对话点评</strong></li>
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
