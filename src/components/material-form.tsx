"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { appConfig, type RoleId } from "@/lib/app-config";

const demoJd = [
  "负责基于大模型的知识助手与智能工作流开发；",
  "设计 RAG 检索、评估和可观测性方案；",
  "优化模型调用的延迟、成本与稳定性；",
  "熟悉 TypeScript 或 Python，有线上 AI 应用落地经验。",
].join("\n");

export function MaterialForm() {
  const [role, setRole] = useState<RoleId>("ai_application");
  const [fileName, setFileName] = useState("");
  const [jd, setJd] = useState("");
  const [demoLoaded, setDemoLoaded] = useState(false);
  const realMaterialsEntered = Boolean(fileName || jd.trim());

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setFileName(event.target.files?.[0]?.name ?? "");
    setDemoLoaded(false);
  }

  function loadDemo() {
    setRole("ai_application");
    setFileName("陈默_AI应用开发_脱敏简历.pdf");
    setJd(demoJd);
    setDemoLoaded(true);
  }

  return (
    <div className="material-form">
      <section className="form-section">
        <div className="section-heading">
          <span>01</span>
          <div>
            <p>ROLE PROFILE</p>
            <h2>选择目标岗位</h2>
          </div>
        </div>
        <div className="role-grid">
          {appConfig.roles.map((item) => (
            <button
              className={role === item.id ? "role-option is-selected" : "role-option"}
              key={item.id}
              onClick={() => setRole(item.id)}
              type="button"
            >
              <span>{role === item.id ? "✓" : "○"}</span>
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
            <input accept=".pdf,application/pdf" onChange={selectFile} type="file" />
            <span className="upload-icon">PDF</span>
            <strong>{fileName || "上传文本型简历 PDF"}</strong>
            <small>最大 8 MB · 扫描件可改用文本粘贴</small>
          </label>
          <label className="jd-field">
            <span>目标 JD</span>
            <textarea
              onChange={(event) => {
                setJd(event.target.value);
                setDemoLoaded(false);
              }}
              placeholder="粘贴岗位职责、任职要求和加分项…"
              value={jd}
            />
            <small>{jd.length} / 12,000</small>
          </label>
        </div>
      </section>

      {realMaterialsEntered && !demoLoaded && (
        <p className="material-status" role="status">
          真实材料已在浏览器中选择，但首个工程骨架尚未上传或解析它们。请先加载脱敏演示材料走通流程。
        </p>
      )}

      <div className="form-actions">
        <button className="button button-secondary" onClick={loadDemo} type="button">
          加载脱敏演示材料
        </button>
        <Link
          aria-disabled={!demoLoaded}
          className={demoLoaded ? "button button-primary" : "button button-primary is-disabled"}
          href={demoLoaded ? "/prepare/confirm?role=" + role : "#"}
          onClick={(event) => {
            if (!demoLoaded) event.preventDefault();
          }}
          tabIndex={demoLoaded ? undefined : -1}
        >
          {demoLoaded ? "确认演示材料" : "真实解析接口待接入"}
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
