import {
  AlgorithmProblemSchema,
  type AlgorithmProblem,
  type InterviewMode,
} from "@/lib/interview/live-schemas";

const HOT_100_PROBLEMS = AlgorithmProblemSchema.array().parse([
  {
    slug: "two-sum",
    title: "两数之和",
    difficulty: "easy",
    thinkingTimeSeconds: 300,
    prompt:
      "给定一个整数数组和目标值，请找出数组中和为目标值的两个不同元素，并返回它们的位置。假设恰好存在一组答案。",
    sourceLabel: "LeetCode Hot 100",
  },
  {
    slug: "longest-substring-without-repeating-characters",
    title: "无重复字符的最长子串",
    difficulty: "medium",
    thinkingTimeSeconds: 420,
    prompt: "给定一个字符串，请找出其中不包含重复字符的最长连续子串长度。",
    sourceLabel: "LeetCode Hot 100",
  },
  {
    slug: "merge-intervals",
    title: "合并区间",
    difficulty: "medium",
    thinkingTimeSeconds: 420,
    prompt:
      "给定若干闭区间，请把所有发生重叠的区间合并，返回互不重叠且覆盖范围相同的区间集合。",
    sourceLabel: "LeetCode Hot 100",
  },
  {
    slug: "number-of-islands",
    title: "岛屿数量",
    difficulty: "medium",
    thinkingTimeSeconds: 420,
    prompt:
      "给定一个由陆地和水组成的二维网格，上下左右相邻的陆地属于同一座岛，请计算岛屿数量。",
    sourceLabel: "LeetCode Hot 100",
  },
  {
    slug: "course-schedule",
    title: "课程表",
    difficulty: "medium",
    thinkingTimeSeconds: 420,
    prompt:
      "给定课程总数和若干先修关系，请判断是否能够完成所有课程，并说明你的判断方法如何实现。",
    sourceLabel: "LeetCode Hot 100",
  },
  {
    slug: "lru-cache",
    title: "LRU 缓存",
    difficulty: "medium",
    thinkingTimeSeconds: 420,
    prompt:
      "设计一个固定容量的 LRU 缓存，支持读取和写入；容量满时应淘汰最久未使用的条目。请口述数据结构与操作过程。",
    sourceLabel: "LeetCode Hot 100",
  },
  {
    slug: "trapping-rain-water",
    title: "接雨水",
    difficulty: "hard",
    thinkingTimeSeconds: 600,
    prompt:
      "给定一组非负整数表示柱子高度，每根柱子宽度为一，请计算下雨后这些柱子之间能够接住多少水。",
    sourceLabel: "LeetCode Hot 100",
  },
]);

function stableHash(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return hash;
}

export function selectHot100Problem(input: {
  sessionId: string;
  mode: InterviewMode;
  roleId: "ai_algorithm" | "ai_application";
}): AlgorithmProblem {
  const allowed = HOT_100_PROBLEMS.filter((problem) => {
    if (input.mode === "quick") return problem.difficulty !== "hard";
    if (input.roleId === "ai_application") return problem.difficulty !== "hard";
    return problem.difficulty !== "easy";
  });
  return allowed[stableHash(`${input.sessionId}:${input.roleId}`) % allowed.length];
}
