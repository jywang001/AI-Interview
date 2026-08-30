import type { CandidateBrief } from "@/lib/interview/schemas";

type CandidateProject = CandidateBrief["projects"][number];

export type ResumeFocus = Readonly<{
  project: CandidateProject;
  score: number;
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
      const depthScore = Math.min(
        8,
        project.responsibilities.length +
          Math.ceil(project.technologies.length / 2) +
          project.confirmedClaims.length,
      );
      const score =
        directTechnologyMatches * 6 +
        englishMatches * 2 +
        chineseMatches +
        (riskMatch ? 8 : 0) +
        (resultClaim ? 3 : 0) +
        depthScore;
      const reasons = [
        directTechnologyMatches + englishMatches > 0 ? "与 JD 技能直接相关" : "",
        riskMatch ? "存在待核验主张" : "",
        depthScore >= 6 ? "可展开技术细节" : "",
        resultClaim ? "包含效果或优化声明" : "",
      ].filter(Boolean);

      return {
        project,
        score: score - originalIndex * 0.01,
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
  const roleFocus =
    brief.roleId === "ai_algorithm"
      ? "重点讲清你负责的算法、数据或实验部分，以及最关键的一次方法判断"
      : "重点讲清你负责的系统模块，以及最关键的一次工程判断";
  return `我们先聊简历里的“${primary.project.name}”。请用几分钟完整介绍项目，${roleFocus}。`;
}

export function pivotResumeQuestion(brief: CandidateBrief) {
  const focuses = rankResumeFocuses(brief);
  const secondary = focuses[1];
  if (secondary) {
    const roleFocus =
      brief.roleId === "ai_algorithm"
        ? "最能体现算法、数据或实验能力的部分"
        : "最能体现系统设计或工程交付能力的部分";
    return `我们换一个项目，不继续追刚才的细节。请讲讲“${secondary.project.name}”里${roleFocus}，以及你实际承担了什么。`;
  }

  const jdSignal = brief.job.requiredSkills[0] ?? brief.job.responsibilities[0];
  return jdSignal
    ? `我们换一个角度。针对岗位要求“${jdSignal}”，你的简历中哪段经历最能证明这项能力？请讲一个具体技术判断。`
    : "我们换一个角度。请从简历中再选一项最能体现目标岗位能力的经历，讲清你的具体贡献和技术判断。";
}
