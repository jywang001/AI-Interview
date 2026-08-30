"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { ElapsedWait } from "@/components/elapsed-wait";
import { appConfig, type RoleId } from "@/lib/app-config";
import { CandidateBriefSchema } from "@/lib/interview/schemas";
import {
  MAX_JD_CHARS,
  MAX_RESUME_BYTES,
  MIN_JD_CHARS,
  MaterialParseResponseSchema,
  type MaterialParseSuccess,
} from "@/lib/materials/schemas";

const MATERIAL_PARSE_STORAGE_KEY = "ai-interview:material-parse:v1";
const CANDIDATE_BRIEF_STORAGE_KEY = "ai-interview:candidate-brief:v1";

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

function buildConfirmedCandidateBrief(payload: MaterialParseSuccess) {
  const { draft } = payload;
  const confirmEvidence = <T extends { confirmed: boolean }>(reference: T) => ({
    ...reference,
    confirmed: true as const,
  });

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
    confirmedAt: new Date().toISOString(),
  });
}

function getResumeError(file: File | null) {
  if (!file) return "请选择一份文本型简历 PDF。";

  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  const normalizedMimeType = file.type.toLowerCase();
  const hasPdfMimeType =
    normalizedMimeType === "" ||
    normalizedMimeType === "application/pdf" ||
    normalizedMimeType === "application/x-pdf";

  if (!hasPdfExtension || !hasPdfMimeType) {
    return "仅支持 PDF 文件，请重新选择。";
  }
  if (file.size === 0) return "所选 PDF 为空，请重新选择。";
  if (file.size > MAX_RESUME_BYTES) return "PDF 不能超过 8 MB。";

  return null;
}

function getJdError(jd: string) {
  const trimmedLength = jd.trim().length;

  if (trimmedLength === 0) return "请粘贴目标岗位 JD。";
  if (trimmedLength < MIN_JD_CHARS) {
    return `JD 至少需要 ${MIN_JD_CHARS} 个字符。`;
  }
  if (jd.length > MAX_JD_CHARS) {
    return `JD 不能超过 ${MAX_JD_CHARS.toLocaleString("zh-CN")} 个字符。`;
  }

  return null;
}

export function MaterialForm() {
  const router = useRouter();
  const [role, setRole] = useState<RoleId>("ai_application");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileTouched, setFileTouched] = useState(false);
  const [jd, setJd] = useState("");
  const [jdTouched, setJdTouched] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  const resumeError = getResumeError(resumeFile);
  const jdError = getJdError(jd);
  const isLoading = submitState.kind === "loading";
  const canSubmit = !resumeError && !jdError && !isLoading;

  function resetSubmitState() {
    if (submitState.kind !== "idle") setSubmitState({ kind: "idle" });
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setResumeFile(event.target.files?.[0] ?? null);
    setFileTouched(true);
    resetSubmitState();
  }

  async function submitRealMaterials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFileTouched(true);
    setJdTouched(true);

    if (!canSubmit || !resumeFile) return;

    setSubmitState({
      kind: "loading",
      message: "正在提取 PDF 并分析材料，请稍候…",
    });

    const formData = new FormData();
    formData.append("resume", resumeFile);
    formData.append("jdText", jd.trim());
    formData.append("roleId", role);

    try {
      const response = await fetch("/api/materials/parse", {
        method: "POST",
        body: formData,
      });
      const rawResponse: unknown = await response.json().catch(() => null);
      const parsedResponse = MaterialParseResponseSchema.safeParse(rawResponse);

      if (!parsedResponse.success) {
        throw new Error("解析服务返回了无法识别的结果，请稍后重试。");
      }

      if (!parsedResponse.data.ok) {
        setSubmitState({
          kind: "error",
          message: parsedResponse.data.message,
        });
        return;
      }

      if (!response.ok) {
        throw new Error("解析服务暂时不可用，请稍后重试。");
      }

      const candidateBrief = buildConfirmedCandidateBrief(parsedResponse.data);
      if (!candidateBrief.success) {
        throw new Error("简历信息未通过完整性校验，请重新提交材料。");
      }

      try {
        sessionStorage.setItem(
          MATERIAL_PARSE_STORAGE_KEY,
          JSON.stringify(parsedResponse.data),
        );
        sessionStorage.setItem(
          CANDIDATE_BRIEF_STORAGE_KEY,
          JSON.stringify(candidateBrief.data),
        );
      } catch {
        throw new Error("浏览器无法保存解析结果，请检查隐私或存储设置后重试。");
      }

      setSubmitState({
        kind: "success",
        message: "材料解析完成，正在进入面试…",
      });
      router.push(`/interview/${appConfig.demoSessionId}?source=live`);
    } catch (error) {
      setSubmitState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "材料解析失败，请检查网络后重试。",
      });
    }
  }

  return (
    <form
      aria-busy={isLoading}
      className="material-form"
      noValidate
      onSubmit={submitRealMaterials}
    >
      <section className="form-section">
        <div className="section-heading">
          <span>01</span>
          <div>
            <p>ROLE PROFILE</p>
            <h2 id="role-profile-heading">选择目标岗位</h2>
          </div>
        </div>
        <div aria-labelledby="role-profile-heading" className="role-grid" role="group">
          {appConfig.roles.map((item) => (
            <button
              aria-pressed={role === item.id}
              className={role === item.id ? "role-option is-selected" : "role-option"}
              disabled={isLoading}
              key={item.id}
              onClick={() => {
                setRole(item.id);
                resetSubmitState();
              }}
              type="button"
            >
              <span aria-hidden="true">{role === item.id ? "✓" : "○"}</span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <span>02</span>
          <div>
            <p>SOURCE MATERIAL</p>
            <h2>提交真实材料</h2>
          </div>
        </div>
        <div className="material-grid">
          <label className="upload-zone">
            <input
              accept=".pdf,application/pdf,application/x-pdf"
              aria-describedby={
                fileTouched && resumeError ? "resume-help resume-error" : "resume-help"
              }
              aria-errormessage={fileTouched && resumeError ? "resume-error" : undefined}
              aria-invalid={fileTouched && Boolean(resumeError)}
              disabled={isLoading}
              onChange={selectFile}
              type="file"
            />
            <span aria-hidden="true" className="upload-icon">
              PDF
            </span>
            <strong>{resumeFile?.name || "上传文本型简历 PDF"}</strong>
            <small id="resume-help">最大 8 MB · 扫描件暂不支持</small>
            {fileTouched && resumeError && (
              <span className="field-error" id="resume-error" role="alert">
                {resumeError}
              </span>
            )}
          </label>
          <label className="jd-field">
            <span>目标 JD</span>
            <textarea
              aria-describedby={jdTouched && jdError ? "jd-count jd-error" : "jd-count"}
              aria-errormessage={jdTouched && jdError ? "jd-error" : undefined}
              aria-invalid={jdTouched && Boolean(jdError)}
              disabled={isLoading}
              maxLength={MAX_JD_CHARS}
              onBlur={() => setJdTouched(true)}
              onChange={(event) => {
                setJd(event.target.value);
                setJdTouched(true);
                resetSubmitState();
              }}
              placeholder="粘贴岗位职责、任职要求和加分项…"
              value={jd}
            />
            <small id="jd-count">
              {jd.length.toLocaleString("zh-CN")} / {MAX_JD_CHARS.toLocaleString("zh-CN")}
            </small>
            {jdTouched && jdError && (
              <span className="field-error" id="jd-error" role="alert">
                {jdError}
              </span>
            )}
          </label>
        </div>
      </section>

      {isLoading ? (
        <div
          className="material-status is-loading"
          id="material-submit-status"
        >
          <ElapsedWait
            active
            label="正在提取 PDF、分析简历并匹配目标 JD"
            timeoutSeconds={60}
          />
        </div>
      ) : submitState.kind !== "idle" ? (
        <p
          aria-live={submitState.kind === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          className={`material-status is-${submitState.kind}`}
          id="material-submit-status"
          role={submitState.kind === "error" ? "alert" : "status"}
        >
          {submitState.message}
        </p>
      ) : null}

      <p className="material-privacy" id="material-privacy">
        简历仅用于生成本场问题。建议先隐去手机号、邮箱等个人信息。
      </p>

      <div className="form-actions" style={{ justifyContent: "flex-end" }}>
        <button
          aria-describedby={
            submitState.kind === "idle"
              ? "material-privacy"
              : "material-privacy material-submit-status"
          }
          className="button button-primary"
          disabled={!canSubmit}
          type="submit"
        >
          {isLoading ? "正在分析材料…" : "生成并开始面试"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
