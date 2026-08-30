"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CandidateBriefSchema } from "@/lib/interview/schemas";
import {
  MaterialParseSuccessSchema,
  type MaterialAnalysisDraft,
  type MaterialParseSuccess,
} from "@/lib/materials/schemas";

const MATERIAL_PARSE_STORAGE_KEY = "ai-interview:material-parse:v1";
const CANDIDATE_BRIEF_STORAGE_KEY = "ai-interview:candidate-brief:v1";

type ConfirmationState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; confirmedAt: string };

type DraftEvidenceReference = MaterialAnalysisDraft["sourceEvidenceRefs"][number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function collectEvidence(draft: MaterialAnalysisDraft) {
  const references = [
    ...draft.sourceEvidenceRefs,
    ...draft.projects.flatMap((project) => project.evidenceRefs),
    ...draft.job.evidenceRefs,
  ];

  return Array.from(
    new Map(references.map((reference) => [reference.id, reference])).values(),
  );
}

function confirmEvidence(reference: DraftEvidenceReference) {
  return { ...reference, confirmed: true };
}

function buildCandidateBrief(payload: MaterialParseSuccess, confirmedAt: string) {
  const { draft } = payload;

  return CandidateBriefSchema.safeParse({
    id: draft.id,
    displayName: draft.displayName,
    roleId: draft.roleId,
    headline: draft.headline,
    education: draft.education,
    experienceHighlights: draft.experienceHighlights,
    projects: draft.projects.map((project) => ({
      ...project,
      evidenceRefs: project.evidenceRefs.map(confirmEvidence),
    })),
    skills: draft.skills,
    job: {
      ...draft.job,
      evidenceRefs: draft.job.evidenceRefs.map(confirmEvidence),
    },
    matchHighlights: draft.matchHighlights,
    verificationRisks: draft.verificationRisks,
    excludedUnconfirmedItems: draft.excludedUnconfirmedItems,
    sourceEvidenceRefs: draft.sourceEvidenceRefs.map(confirmEvidence),
    confirmedAt,
  });
}

function EmptyListMessage({ children }: { children: string }) {
  return <p className="review-empty">{children}</p>;
}

export function LiveMaterialReview() {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [payload, setPayload] = useState<MaterialParseSuccess | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({ kind: "idle" });

  useEffect(() => {
    try {
      const storedValue = sessionStorage.getItem(MATERIAL_PARSE_STORAGE_KEY);

      if (!storedValue) {
        setReadError("没有找到本次解析结果。请返回准备页重新提交简历和 JD。");
        return;
      }

      const parsedJson: unknown = JSON.parse(storedValue);
      const parsedPayload = MaterialParseSuccessSchema.safeParse(parsedJson);

      if (!parsedPayload.success) {
        setReadError("浏览器中的解析结果已损坏或版本不兼容，请返回准备页重新解析。");
        return;
      }

      const storedCandidateBrief = sessionStorage.getItem(
        CANDIDATE_BRIEF_STORAGE_KEY,
      );
      if (storedCandidateBrief) {
        try {
          const parsedCandidateBrief = CandidateBriefSchema.safeParse(
            JSON.parse(storedCandidateBrief) as unknown,
          );
          if (
            parsedCandidateBrief.success &&
            parsedCandidateBrief.data.id === parsedPayload.data.draft.id
          ) {
            setConfirmation({
              kind: "success",
              confirmedAt: parsedCandidateBrief.data.confirmedAt,
            });
          }
        } catch {
          // A stale confirmation must not prevent reviewing a valid fresh draft.
        }
      }

      setPayload(parsedPayload.data);
    } catch {
      setReadError("无法读取浏览器中的解析结果，请返回准备页重新解析。");
    } finally {
      setHasLoaded(true);
    }
  }, []);

  function confirmMaterials() {
    if (!payload || confirmation.kind === "success") return;

    const confirmedAt = new Date().toISOString();
    const candidateBrief = buildCandidateBrief(payload, confirmedAt);

    if (!candidateBrief.success) {
      setConfirmation({
        kind: "error",
        message: "确认数据未通过完整性校验，请返回准备页重新解析。",
      });
      return;
    }

    try {
      sessionStorage.setItem(
        CANDIDATE_BRIEF_STORAGE_KEY,
        JSON.stringify(candidateBrief.data),
      );
      setConfirmation({ kind: "success", confirmedAt });
    } catch {
      setConfirmation({
        kind: "error",
        message: "浏览器无法保存确认结果，请检查隐私或存储设置后重试。",
      });
    }
  }

  function clearMaterials() {
    try {
      sessionStorage.removeItem(MATERIAL_PARSE_STORAGE_KEY);
      sessionStorage.removeItem(CANDIDATE_BRIEF_STORAGE_KEY);
    } finally {
      setPayload(null);
      setConfirmation({ kind: "idle" });
      setReadError("本次解析结果和已确认 CandidateBrief 已从当前浏览器会话清除。");
    }
  }

  if (!hasLoaded) {
    return (
      <>
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">CONFIRM / 02</p>
            <h1>正在读取解析结果。</h1>
          </div>
          <p>确认页只会读取本标签页刚刚保存的材料，不会回退到预置演示数据。</p>
        </header>
        <section aria-live="polite" className="panel live-review-state" role="status">
          <span className="status-pill">读取中</span>
          <h2>正在准备事实核对清单…</h2>
        </section>
      </>
    );
  }

  if (readError || !payload) {
    return (
      <>
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">CONFIRM / 02</p>
            <h1>这份解析结果无法继续确认。</h1>
          </div>
          <p>这里不会用演示数据替代缺失或损坏的真实材料，你可以安全返回并重新提交。</p>
        </header>
        <section className="panel live-review-state" role="alert">
          <span className="status-pill is-warning">需要重新解析</span>
          <h2>未读取到有效材料</h2>
          <p>{readError ?? "解析结果不可用。"}</p>
          <Link className="button button-primary" href="/prepare">
            返回准备页
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      </>
    );
  }

  const { draft, meta } = payload;
  const evidenceReferences = collectEvidence(draft);

  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">CONFIRM / 02 · LIVE</p>
          <h1>先核对模型提取的事实，再决定是否确认。</h1>
        </div>
        <p>
          下列内容来自你刚提交的 PDF 与 JD；所有项目主张在你点击确认前都只是待核对草稿。
        </p>
      </header>

      <div className="confirm-layout live-confirm-layout">
        <section className="panel material-review" aria-labelledby="live-brief-title">
          <div className="panel-title">
            <div>
              <p>CANDIDATE BRIEF DRAFT</p>
              <h2 id="live-brief-title">{draft.displayName} · 实时解析草稿</h2>
            </div>
            <span className="status-pill">待你确认</span>
          </div>

          <div className="review-group">
            <h3>候选人概况</h3>
            <p className="review-lead">{draft.headline}</p>
            <div className="tag-list" aria-label="候选人技能">
              <span className="tag">
                {draft.roleId === "ai_algorithm" ? "AI 算法岗" : "AI 应用开发岗"}
              </span>
              {draft.skills.map((skill) => (
                <span className="tag" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            {(draft.education.length > 0 || draft.experienceHighlights.length > 0) && (
              <ul className="compact-review-list">
                {draft.education.map((item) => (
                  <li key={`education-${item}`}>{item}</li>
                ))}
                {draft.experienceHighlights.map((item) => (
                  <li key={`experience-${item}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          {draft.projects.map((project) => (
            <div className="review-group" key={project.id}>
              <h3>待确认项目主张 · {project.name}</h3>
              <p className="review-lead">{project.context}</p>
              <div className="tag-list" aria-label={`${project.name} 技术栈`}>
                {project.technologies.map((technology) => (
                  <span className="tag" key={technology}>
                    {technology}
                  </span>
                ))}
              </div>
              <ul className="claim-list live-claim-list">
                {project.confirmedClaims.map((claim, index) => (
                  <li className="claim-item" key={`${project.id}-claim-${index}`}>
                    <span aria-hidden="true">?</span>
                    <div>
                      <strong>{claim}</strong>
                      <small>待你确认 · 项目主张 {index + 1}</small>
                    </div>
                  </li>
                ))}
              </ul>
              <details className="review-details">
                <summary>查看职责提取</summary>
                <ul className="compact-review-list">
                  {project.responsibilities.map((responsibility) => (
                    <li key={responsibility}>{responsibility}</li>
                  ))}
                </ul>
              </details>
            </div>
          ))}

          <div className="review-group">
            <h3>证据来源 · {evidenceReferences.length} 条</h3>
            <ul className="evidence-source-list">
              {evidenceReferences.map((reference) => (
                <li key={reference.id}>
                  <div>
                    <span className="evidence-source-type">
                      {reference.sourceType === "resume" ? "简历" : "JD"}
                    </span>
                    <small>{reference.location ?? "未标注位置"}</small>
                  </div>
                  <q>{reference.excerpt}</q>
                </li>
              ))}
            </ul>
          </div>

          <div className="review-group">
            <h3>目标 JD · {draft.job.title}</h3>
            {draft.job.companyLabel && <p className="review-lead">{draft.job.companyLabel}</p>}
            <div className="review-columns">
              <div>
                <h4>岗位职责</h4>
                <ul className="compact-review-list">
                  {draft.job.responsibilities.map((responsibility) => (
                    <li key={responsibility}>{responsibility}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>必备能力</h4>
                <ul className="compact-review-list">
                  {draft.job.requiredSkills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="review-columns">
              <div>
                <h4>加分项</h4>
                {draft.job.preferredSkills.length > 0 ? (
                  <ul className="compact-review-list">
                    {draft.job.preferredSkills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <EmptyListMessage>未提取到明确加分项</EmptyListMessage>
                )}
              </div>
              <div>
                <h4>岗位约束</h4>
                {draft.job.constraints.length > 0 ? (
                  <ul className="compact-review-list">
                    {draft.job.constraints.map((constraint) => (
                      <li key={constraint}>{constraint}</li>
                    ))}
                  </ul>
                ) : (
                  <EmptyListMessage>未提取到明确岗位约束</EmptyListMessage>
                )}
              </div>
            </div>
          </div>

          <div className="review-group">
            <h3>风险与排除项</h3>
            <div className="review-columns">
              <div>
                <h4>本场需要验证</h4>
                {draft.verificationRisks.length > 0 ? (
                  <ul className="compact-review-list is-risk">
                    {draft.verificationRisks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                ) : (
                  <EmptyListMessage>解析未标记额外验证风险</EmptyListMessage>
                )}
              </div>
              <div>
                <h4>未纳入事实</h4>
                {draft.excludedUnconfirmedItems.length > 0 ? (
                  <ul className="compact-review-list is-excluded">
                    {draft.excludedUnconfirmedItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <EmptyListMessage>没有额外排除项</EmptyListMessage>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="panel plan-panel live-confirm-panel" aria-labelledby="confirm-action-title">
          <div className="panel-title">
            <div>
              <p>FACT CONFIRMATION</p>
              <h2 id="confirm-action-title">确认范围与解析信息</h2>
            </div>
            <span className="status-pill">LIVE</span>
          </div>

          <div className="live-match-summary">
            <h3>岗位匹配线索</h3>
            <ul>
              {draft.matchHighlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </div>

          <dl className="parse-meta-list">
            <div>
              <dt>简历文件</dt>
              <dd>{meta.resumeFileName}</dd>
            </div>
            <div>
              <dt>文本字符</dt>
              <dd>{meta.resumeCharacterCount.toLocaleString("zh-CN")}</dd>
            </div>
            <div>
              <dt>JD 字符</dt>
              <dd>{meta.jdCharacterCount.toLocaleString("zh-CN")}</dd>
            </div>
            <div>
              <dt>提取方式</dt>
              <dd>{meta.extractionMethod}</dd>
            </div>
            <div>
              <dt>解析模型</dt>
              <dd>{meta.model}</dd>
            </div>
            <div>
              <dt>生成时间</dt>
              <dd>{formatDate(meta.createdAt)}</dd>
            </div>
            <div>
              <dt>提供方模式</dt>
              <dd>{draft.providerMode}</dd>
            </div>
            <div>
              <dt>请求 ID</dt>
              <dd>{meta.requestId}</dd>
            </div>
          </dl>

          <p className="live-confirm-notice">
            确认只会在当前浏览器保存 CandidateBrief，并把所有展示过的简历/JD 证据标为已确认。动态面试尚未接入，因此这里不会跳转到预置 Demo 面试。
          </p>

          {confirmation.kind === "error" && (
            <p className="live-confirm-message is-error" role="alert">
              {confirmation.message}
            </p>
          )}
          {confirmation.kind === "success" && (
            <p aria-live="polite" className="live-confirm-message is-success" role="status">
              已于 {formatDate(confirmation.confirmedAt)} 保存到本浏览器。动态面试仍待接入。
            </p>
          )}

          <button
            className="button button-light"
            disabled={confirmation.kind === "success"}
            onClick={confirmMaterials}
            type="button"
          >
            {confirmation.kind === "success" ? "已确认材料" : "确认材料（暂不开始面试）"}
            <span aria-hidden="true">→</span>
          </button>
          <Link className="button button-ghost" href="/prepare">
            返回修改材料
          </Link>
          <button className="button button-ghost" onClick={clearMaterials} type="button">
            清除本次浏览器材料
          </button>
        </aside>
      </div>
    </>
  );
}
