import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { appConfig } from "@/lib/app-config";

const loop = [
  {
    index: "01",
    title: "确认材料",
    copy: "把简历主张与 JD 能力拆开核对，错误不带进面试。",
  },
  {
    index: "02",
    title: "接受追问",
    copy: "完整走过六个面试阶段，每一轮都根据回答充分性决定追问或推进。",
  },
  {
    index: "03",
    title: "查看证据",
    copy: "每个判断回到回答原文，不给无法解释的漂亮分数。",
  },
  {
    index: "04",
    title: "立即重练",
    copy: "围绕同一目标重答，比较新增证据与仍然缺失的部分。",
  },
] as const;

export default function Home() {
  return (
    <AppShell>
      <main className="home-page">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">FOR AI ALGORITHM & APPLICATION ROLES</p>
            <h1>
              你的简历，
              <br />
              不只要经得起浏览。
              <em>还要经得起追问。</em>
            </h1>
            <p className="hero-lead">{appConfig.tagline}</p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" href="/prepare">
                创建一场训练
                <span>→</span>
              </Link>
              <Link
                className="button button-secondary button-large"
                href={"/report/" + appConfig.demoSessionId}
              >
                查看完整 Demo
              </Link>
            </div>
            <p className="microcopy">
              中文 · 快速综合模式 · 无需登录 · 语音失败可切换文字
            </p>
          </div>

          <div className="hero-board" aria-label="产品闭环示意">
            <div className="board-header">
              <span>SESSION / AI APPLICATION</span>
              <span className="live-dot">DEMO READY</span>
            </div>
            <div className="question-preview">
              <p>RESUME DEEP DIVE · STAGE 02 / 06</p>
              <blockquote>
                你提到把检索链路的 P95 延迟降低了 38%。这个结果中，哪一部分是你负责的？
              </blockquote>
              <div className="source-line">
                <span>来源</span>
                简历 · “知识库问答平台” · 第 2 页
              </div>
            </div>
            <div className="evidence-preview">
              <div>
                <span className="evidence-label is-good">已有证据</span>
                <strong>定位到 reranker 与串行请求</strong>
              </div>
              <div>
                <span className="evidence-label is-gap">仍然缺失</span>
                <strong>个人修改范围与对照数据</strong>
              </div>
            </div>
            <div className="board-footer">
              <span>不是给答案</span>
              <strong>是让答案经得起下一问。</strong>
            </div>
          </div>
        </section>

        <section className="promise-strip">
          <p>ONE SESSION PROMISE</p>
          <strong>{appConfig.promise}</strong>
        </section>

        <section className="product-loop">
          <div className="section-intro">
            <p className="eyebrow">THE TRAINING LOOP</p>
            <h2>一次训练，必须留下下一步。</h2>
          </div>
          <div className="loop-grid">
            {loop.map((item) => (
              <article key={item.index}>
                <span>{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="role-comparison">
          <div className="section-intro">
            <p className="eyebrow">ROLE-SPECIFIC BY DESIGN</p>
            <h2>同一份项目，两种岗位，两套追问重点。</h2>
          </div>
          <div className="role-comparison-grid">
            {appConfig.roles.map((role, index) => (
              <article key={role.id}>
                <span>{index === 0 ? "MODEL / DATA" : "SYSTEM / DELIVERY"}</span>
                <h3>{role.label}</h3>
                <p>{role.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="closing-cta">
          <div>
            <p className="eyebrow">READY WHEN YOU ARE</p>
            <h2>从一份真实简历开始。</h2>
          </div>
          <Link className="button button-light button-large" href="/prepare">
            进入准备室
            <span>→</span>
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
