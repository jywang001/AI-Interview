export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "AI Interview",
  shortName: "AI·I",
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ??
    "把简历里的每一句话，练成经得起追问的回答。",
  promise:
    "基于一份真实简历和目标 JD，连续完成六阶段岗位化模拟面试，找到 3 个以内的关键证据缺口与优先改进方向。",
  voiceFlow: {
    mode: "turn_based",
    promise: "每轮语音先转写并由用户确认，再进入动态追问与证据复盘。",
    fallback: "任一语音服务失败时，问题文字和文字回答仍可完成整场面试。",
  },
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
    { href: "/", label: "首页", key: "home" },
    { href: "/prepare", label: "开始面试", key: "interview" },
    { href: "/reports", label: "复盘提升", key: "report" },
  ],
} as const;

export type RoleId = (typeof appConfig.roles)[number]["id"];
