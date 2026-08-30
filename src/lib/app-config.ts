export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "AI Interview",
  shortName: "AI·I",
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ??
    "把简历里的每一句话，练成经得起追问的回答。",
  promise:
    "基于一份真实简历和目标 JD，完成 5 轮岗位化模拟面试，找到 3 个以内的关键证据缺口，并立即重练其中 1 项。",
  demoSessionId: "demo-ai-developer",
  roles: [
    {
      id: "ai_algorithm",
      label: "AI 算法岗",
      description: "聚焦建模、数据、实验、指标、bad case 与泛化。",
    },
    {
      id: "ai_application",
      label: "AI 应用开发岗",
      description: "聚焦架构、模型集成、评估、延迟、成本与可靠性。",
    },
  ],
  navigation: [
    { href: "/prepare", label: "准备材料" },
    { href: "/interview/demo-ai-developer", label: "模拟面试" },
    { href: "/report/demo-ai-developer", label: "证据复盘" },
  ],
} as const;

export type RoleId = (typeof appConfig.roles)[number]["id"];
