"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { appConfig, type RoleId } from "@/lib/app-config";
import {
  MAX_JD_CHARS,
  MAX_RESUME_BYTES,
  MIN_JD_CHARS,
  MaterialParseResponseSchema,
} from "@/lib/materials/schemas";

const MATERIAL_PARSE_STORAGE_KEY = "ai-interview:material-parse:v1";

const demoJd = [
  "负责基于大模型的知识助手与智能工作流开发；",
  "设计 RAG 检索、评估和可观测性方案；",
  "优化模型调用的延迟、成本与稳定性；",
  "熟悉 TypeScript 或 Python，有线上 AI 应用落地经验。",
].join("\n");

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<RoleId>("ai_application");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileTouched, setFileTouched] = useState(false);
  const [jd, setJd] = useState("");
  const [jdTouched, setJdTouched] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  const resumeError = getResumeError(resumeFile);
  const jdError = getJdError(jd);
  const isLoading = submitState.kind === "loading";
  const canSubmit = !demoLoaded && !resumeError && !jdError && !isLoading;

  function resetSubmitState() {
    if (submitState.kind !== "idle") setSubmitState({ kind: "idle" });
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setResumeFile(event.target.files?.[0] ?? null);
    setFileTouched(true);
    setDemoLoaded(false);
    resetSubmitState();
  }

  function loadDemo() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setRole("ai_application");
    setResumeFile(null);
    setFileTouched(false);
    setJd(demoJd);
    setJdTouched(false);
    setDemoLoaded(true);
    setSubmitState({ kind: "idle" });
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

      try {
        sessionStorage.setItem(
          MATERIAL_PARSE_STORAGE_KEY,
          JSON.stringify(parsedResponse.data),
        );
      } catch {
        throw new Error("浏览器无法保存解析结果，请检查隐私或存储设置后重试。");
      }

      setSubmitState({
        kind: "success",
        message: "材料解析完成，正在进入事实确认页…",
      });
      router.push("/prepare/confirm?source=live");
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
              ref={fileInputRef}
              type="file"
            />
            <span aria-hidden="true" className="upload-icon">
              PDF
            </span>
            <strong>
              {demoLoaded
                ? "内置脱敏演示材料（未选择本地文件）"
                : resumeFile?.name || "上传文本型简历 PDF"}
            </strong>
            <small id="resume-help">
              {demoLoaded
                ? "演示路径读取内置 fixture，不会上传文件"
                : "最大 8 MB · 扫描件暂不支持"}
            </small>
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
                setDemoLoaded(false);
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

      {demoLoaded && (
        <p className="material-status" id="demo-material-status" role="status">
          已加载脱敏演示内容。你可以进入原有 Demo 确认页；它不会调用真实解析接口。
        </p>
      )}

      {submitState.kind !== "idle" && (
        <p
          aria-live={submitState.kind === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          className={`material-status is-${submitState.kind}`}
          id="material-submit-status"
          role={submitState.kind === "error" ? "alert" : "status"}
        >
          {submitState.message}
        </p>
      )}

      {!demoLoaded && (
        <p className="material-privacy" id="material-privacy">
          提交真实材料会把 PDF 提取文本与 JD 发送给当前配置的模型服务处理。应用服务端不落盘保存；返回的结构化草稿与必要原文摘录只写入当前标签页的 sessionStorage，可在确认页清除。若使用第三方供应商，其处理区域、日志与留存以供应商条款和部署配置为准，本应用无法代其承诺零留存。请只提交你有权处理的材料，并优先脱敏。
        </p>
      )}

      <div className="form-actions">
        <button
          className="button button-secondary"
          disabled={isLoading}
          onClick={loadDemo}
          type="button"
        >
          加载脱敏演示材料
        </button>
        {demoLoaded ? (
          <Link className="button button-primary" href={`/prepare/confirm?role=${role}`}>
            确认演示材料
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
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
            {isLoading ? "正在解析…" : "解析真实材料"}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </form>
  );
}
