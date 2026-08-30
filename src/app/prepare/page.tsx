import { AppShell } from "@/components/app-shell";
import { FlowProgress } from "@/components/flow-progress";
import { MaterialForm } from "@/components/material-form";

export default function PreparePage() {
  return (
    <AppShell active="prepare">
      <main className="workspace-page">
        <FlowProgress current="prepare" />
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">PREPARE / 01</p>
            <h1>先让系统理解你，再开始提问。</h1>
          </div>
          <p>
            首版固定中文快速综合模式。简历和 JD 会先生成可编辑草稿，未经你确认的内容不会被当作事实。
          </p>
        </header>
        <MaterialForm />
      </main>
    </AppShell>
  );
}
