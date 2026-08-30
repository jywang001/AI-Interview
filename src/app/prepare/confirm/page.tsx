import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { FlowProgress } from "@/components/flow-progress";
import {
  demoCandidateBrief,
  demoInterviewSession,
} from "@/fixtures/demo-session";

export const metadata: Metadata = {
  title: "确认材料",
};

type ConfirmPageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const { role } = await searchParams;
  const requestedAlgorithm = role === "ai_algorithm";
  const project = demoCandidateBrief.projects[0];

  return (
    <AppShell active="prepare">
      <main className="workspace-page">
        <FlowProgress current="confirm" />
        <DemoBanner />
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">CONFIRM / 02</p>
            <h1>先核对事实，再把它交给面试官。</h1>
          </div>
          <p>
            当前离线 fixture 使用 AI 应用开发岗。{requestedAlgorithm
              ? "你选择了算法岗；岗位配置入口已保留，首个可运行样例仍会使用开发岗材料。"
              : "系统只会把此页确认过的信息作为后续问题与反馈依据。"}
          </p>
        </header>

        <div className="confirm-layout">
          <section className="panel material-review">
            <div className="panel-title">
              <div>
                <p>CANDIDATE BRIEF</p>
                <h2>{demoCandidateBrief.displayName} · 已解析材料</h2>
              </div>
              <span className="status-pill">待你确认</span>
            </div>

            <div className="review-group">
              <h3>候选人概况</h3>
              <div className="tag-list">
                <span className="tag">{demoCandidateBrief.headline}</span>
                {demoCandidateBrief.skills.map((skill) => (
                  <span className="tag" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="review-group">
              <h3>已确认项目主张 · {project.name}</h3>
              <ul className="claim-list">
                {project.confirmedClaims.map((claim, index) => (
                  <li className="claim-item" key={claim}>
                    <span>✓</span>
                    <div>
                      <strong>{claim}</strong>
                      <small>简历项目经历 · 主张 {index + 1}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="review-group">
              <h3>目标 JD 能力</h3>
              <ul className="claim-list">
                {demoCandidateBrief.job.requiredSkills.map((skill) => (
                  <li className="claim-item" key={skill}>
                    <span>✓</span>
                    <div>
                      <strong>{skill}</strong>
                      <small>{demoCandidateBrief.job.title} · 必备能力</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="review-group">
              <h3>本场需要验证的风险</h3>
              <ul className="claim-list">
                {demoCandidateBrief.verificationRisks.map((risk) => (
                  <li className="claim-item" key={risk}>
                    <span>!</span>
                    <div>
                      <strong>{risk}</strong>
                      <small>仅作为追问方向，不代表负面结论</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="panel plan-panel">
            <div className="panel-title">
              <div>
                <p>INTERVIEW PLAN</p>
                <h2>本场考察范围</h2>
              </div>
              <span className="status-pill">4 OBJ / 5 TURNS</span>
            </div>

            <ol className="objective-list">
              {demoInterviewSession.objectives.map((objective) => (
                <li key={objective.id}>
                  <div>
                    <strong>{objective.title}</strong>
                    <small>{objective.evidenceGoal}</small>
                  </div>
                  <span>{objective.maxFollowUps > 0 ? "2 轮" : "1 轮"}</span>
                </li>
              ))}
            </ol>

            <div className="plan-meta">
              <div>
                <span>语言</span>
                <strong>中文</strong>
              </div>
              <div>
                <span>模式</span>
                <strong>快速综合</strong>
              </div>
              <div>
                <span>预计</span>
                <strong>10–15 分钟</strong>
              </div>
            </div>

            <Link
              className="button button-light"
              href={"/interview/" + demoInterviewSession.id}
            >
              确认并进入面试
              <span>→</span>
            </Link>
            <Link className="button button-ghost" href="/prepare">
              返回修改材料
            </Link>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
