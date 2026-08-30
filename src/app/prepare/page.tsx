import { AppShell } from "@/components/app-shell";
import { MaterialForm } from "@/components/material-form";

export default function PreparePage() {
  return (
    <AppShell active="interview">
      <main className="workspace-page">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">开始面试</p>
            <h1>开始一场面试</h1>
          </div>
          <p>
            选择目标岗位，上传简历并粘贴 JD，提交后直接进入面试。
          </p>
        </header>
        <MaterialForm />
      </main>
    </AppShell>
  );
}
