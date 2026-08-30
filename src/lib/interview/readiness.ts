export type TrainingReadiness = Readonly<{
  className: "is-strong" | "is-ready" | "is-developing";
  description: string;
  label: "表现扎实" | "基本就绪" | "重点补强";
}>;

export function getTrainingReadiness(score: number): TrainingReadiness {
  if (score >= 85) {
    return {
      className: "is-strong",
      label: "表现扎实",
      description: "本场回答中的核心能力证据较充分",
    };
  }

  if (score >= 70) {
    return {
      className: "is-ready",
      label: "基本就绪",
      description: "基础能力已经体现，仍有关键证据需要补强",
    };
  }

  return {
    className: "is-developing",
    label: "重点补强",
    description: "建议优先练习报告列出的关键能力缺口",
  };
}
