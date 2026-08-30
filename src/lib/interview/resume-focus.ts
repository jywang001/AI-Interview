import type { CandidateBrief } from "@/lib/interview/schemas";

type CandidateProject = CandidateBrief["projects"][number];
export type ExperienceKind = "research" | "internship" | "project";

export type ResumeFocus = Readonly<{
  project: CandidateProject;
  kind: ExperienceKind;
  score: number;
  jdMatchScore: number;
  roleAffinityScore: number;
  reasons: readonly string[];
}>;

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

function englishTokens(value: string) {
  return new Set(value.match(/[a-z][a-z0-9.+#-]{1,}/giu)?.map(normalized) ?? []);
}

function chineseBigrams(value: string) {
  const result = new Set<string>();
  for (const sequence of value.match(/[\p{Script=Han}]{2,}/gu) ?? []) {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      result.add(sequence.slice(index, index + 2));
    }
  }
  return result;
}

function overlapCount(left: Set<string>, right: Set<string>, cap: number) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
    if (count >= cap) return cap;
  }
  return count;
}

function hasResultClaim(project: CandidateProject) {
  return project.confirmedClaims.some((claim) =>
    /%|提升|提高|降低|减少|优化|缩短|增长|准确率|召回率|成功率|错误率|延迟|吞吐|性能|成本|效果|P\d+|QPS/iu.test(
      claim,
    ),
  );
}

const RESEARCH_SIGNALS = [
  "科研",
  "研究",
  "论文",
  "课题",
  "实验室",
  "导师",
  "投稿",
  "录用",
  "paper",
  "research",
  "baseline",
  "benchmark",
  "消融",
  "数据集",
];

const INTERNSHIP_SIGNALS = [
  "实习",
  "intern",
  "公司",
  "部门",
  "业务",
  "客户",
  "线上",
  "生产环境",
  "交付",
];

const ALGORITHM_SIGNALS = [
  "模型",
  "训练",
  "算法",
  "数据",
  "微调",
  "推理",
  "准确率",
  "召回率",
  "embedding",
  "transformer",
  "pytorch",
  "tensorflow",
];

const ENGINEERING_SIGNALS = [
  "系统",
  "服务",
  "接口",
  "api",
  "后端",
  "前端",
  "数据库",
  "缓存",
  "部署",
  "并发",
  "监控",
  "降级",
  "docker",
  "typescript",
  "java",
  "go",
];

function signalCount(text: string, signals: readonly string[]) {
  return signals.filter((signal) => text.includes(normalized(signal))).length;
}

function classifyExperience(project: CandidateProject): ExperienceKind {
  const text = normalized(
    [
      project.name,
      project.context,
      ...project.responsibilities,
      ...project.confirmedClaims,
    ].join(" "),
  );
  const research = signalCount(text, RESEARCH_SIGNALS);
  const internship = signalCount(text, INTERNSHIP_SIGNALS);
  if (research >= 2 && research >= internship) return "research";
  if (internship >= 1) return "internship";
  return "project";
}

function kindLabel(kind: ExperienceKind) {
  if (kind === "research") return "科研经历";
  if (kind === "internship") return "实习经历";
  return "项目经历";
}

export function rankResumeFocuses(brief: CandidateBrief): ResumeFocus[] {
  const jdText = normalized(
    [
      brief.job.title,
      ...brief.job.responsibilities,
      ...brief.job.requiredSkills,
      ...brief.job.preferredSkills,
      ...brief.job.constraints,
    ].join(" "),
  );
  const jdEnglish = englishTokens(jdText);
  const jdChinese = chineseBigrams(jdText);
  const risks = brief.verificationRisks.map(normalized);

  return brief.projects
    .map((project, originalIndex) => {
      const projectText = normalized(
        [
          project.name,
          project.context,
          ...project.responsibilities,
          ...project.technologies,
          ...project.confirmedClaims,
        ].join(" "),
      );
      const directTechnologyMatches = project.technologies.filter((technology) =>
        jdText.includes(normalized(technology)),
      ).length;
      const englishMatches = overlapCount(englishTokens(projectText), jdEnglish, 8);
      const chineseMatches = overlapCount(chineseBigrams(projectText), jdChinese, 10);
      const riskMatch = risks.some(
        (risk) =>
          risk.includes(normalized(project.name)) ||
          project.technologies.some((technology) =>
            risk.includes(normalized(technology)),
          ),
      );
      const resultClaim = hasResultClaim(project);
      const kind = classifyExperience(project);
      const algorithmSignalCount = signalCount(projectText, ALGORITHM_SIGNALS);
      const engineeringSignalCount = signalCount(projectText, ENGINEERING_SIGNALS);
      const jdMatchScore =
        directTechnologyMatches * 12 +
        englishMatches * 4 +
        chineseMatches;
      const roleAffinityScore =
        brief.roleId === "ai_algorithm"
          ? (kind === "research" ? 14 : kind === "internship" ? 3 : 5) +
            Math.min(12, algorithmSignalCount * 2)
          : (kind === "internship" ? 12 : kind === "project" ? 8 : 2) +
            Math.min(12, engineeringSignalCount * 2);
      const depthScore = Math.min(
        8,
        project.responsibilities.length +
          Math.ceil(project.technologies.length / 2) +
          project.confirmedClaims.length,
      );
      const score =
        jdMatchScore +
        roleAffinityScore +
        (riskMatch ? 5 : 0) +
        (resultClaim ? 2 : 0) +
        depthScore;
      const reasons = [
        kindLabel(kind),
        jdMatchScore >= 12
          ? "与 JD 高度相关"
          : jdMatchScore > 0
            ? "与 JD 部分相关"
            : "",
        brief.roleId === "ai_algorithm" && kind === "research"
          ? "算法岗优先科研"
          : "",
        brief.roleId === "ai_application" && kind === "internship"
          ? "开发岗优先对口实习"
          : "",
        riskMatch ? "存在待核验主张" : "",
        depthScore >= 6 ? "可展开技术细节" : "",
        resultClaim ? "包含效果或优化声明" : "",
      ].filter(Boolean);

      return {
        project,
        kind,
        score: score - originalIndex * 0.01,
        jdMatchScore,
        roleAffinityScore,
        reasons: reasons.length > 0 ? reasons : ["简历中的代表性经历"],
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function primaryResumeQuestion(brief: CandidateBrief) {
  const primary = rankResumeFocuses(brief)[0];
  if (!primary) {
    return "请选择简历中最能体现目标岗位能力的一段经历，说明你亲自做了什么以及最关键的技术判断。";
  }
  if (brief.roleId === "ai_algorithm") {
    return primary.kind === "research"
      ? `我们先聊你的科研经历“${primary.project.name}”。这个工作具体研究什么问题？请重点说明你亲自负责的方法或实验部分。`
      : `我们先聊“${primary.project.name}”里最接近算法岗的部分。你亲自处理了什么数据或模型问题？先讲一个具体工作。`;
  }
  return primary.kind === "internship"
    ? `我们先聊你的实习经历“${primary.project.name}”。挑一个与目标 JD 最相关的交付任务，说明你亲自负责哪条系统链路。`
    : `我们先聊项目“${primary.project.name}”。它解决什么实际问题？请重点说明你亲自实现的一条系统链路。`;
}

export function pivotResumeQuestion(brief: CandidateBrief) {
  const focuses = rankResumeFocuses(brief);
  const secondary = focuses[1];
  if (secondary) {
    if (brief.roleId === "ai_algorithm") {
      return `这个点先到这里。我们换到${kindLabel(secondary.kind)}“${secondary.project.name}”：其中哪项工作最能体现你的算法、数据或实验能力？`;
    }
    return `这个点先到这里。我们换到${kindLabel(secondary.kind)}“${secondary.project.name}”：其中哪项任务与目标 JD 最相关，你亲自实现了哪一部分？`;
  }

  const jdSignal = brief.job.requiredSkills[0] ?? brief.job.responsibilities[0];
  return jdSignal
    ? `我们换一个角度。针对岗位要求“${jdSignal}”，你的简历中哪段经历最能证明这项能力？请讲一个具体技术判断。`
    : "我们换一个角度。请从简历中再选一项最能体现目标岗位能力的经历，讲清你的具体贡献和技术判断。";
}
