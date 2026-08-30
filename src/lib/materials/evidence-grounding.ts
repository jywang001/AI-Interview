import {
  MaterialModelOutputSchema,
  type MaterialEvidenceSeed,
  type MaterialModelOutput,
} from "@/lib/materials/schemas";

type SourceType = MaterialEvidenceSeed["sourceType"];

function canonicalCharacter(value: string) {
  return Array.from(value.normalize("NFKC").toLocaleLowerCase("zh-CN")).filter(
    (character) => /[\p{L}\p{N}]/u.test(character),
  );
}

function canonicalSource(value: string) {
  const characters: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;

  for (const sourceCharacter of value) {
    const start = offset;
    offset += sourceCharacter.length;
    for (const character of canonicalCharacter(sourceCharacter)) {
      characters.push(character);
      starts.push(start);
      ends.push(offset);
    }
  }

  return { text: characters.join(""), starts, ends };
}

/**
 * Returns the original source substring, never the model-authored quote.
 * PDF whitespace, punctuation and full/half-width differences are ignored,
 * while the remaining letters, numbers and CJK characters must stay in order.
 */
export function alignExcerptToSource(source: string, proposedExcerpt: string) {
  const trimmed = proposedExcerpt.trim();
  if (!trimmed) return null;

  const exactIndex = source.indexOf(trimmed);
  if (exactIndex >= 0) return source.slice(exactIndex, exactIndex + trimmed.length);

  const needle = canonicalCharacter(trimmed).join("");
  if (needle.length < 6) return null;
  const haystack = canonicalSource(source);
  const canonicalIndex = haystack.text.indexOf(needle);
  if (canonicalIndex < 0) return null;

  const start = haystack.starts[canonicalIndex];
  const end = haystack.ends[canonicalIndex + needle.length - 1];
  if (start === undefined || end === undefined) return null;
  return source.slice(start, end).trim();
}

function deduplicateSeeds(seeds: MaterialEvidenceSeed[]) {
  return Array.from(
    new Map(
      seeds.map((seed) => [
        `${seed.sourceType}\u0000${seed.excerpt}\u0000${seed.location}`,
        seed,
      ]),
    ).values(),
  );
}

function groundedSeed(
  seed: MaterialEvidenceSeed,
  expectedSource: SourceType,
  source: string,
) {
  const excerpt = alignExcerptToSource(source, seed.excerpt);
  if (!excerpt) return null;
  return {
    ...seed,
    sourceType: expectedSource,
    excerpt,
  } satisfies MaterialEvidenceSeed;
}

function fallbackSeeds(
  values: readonly string[],
  expectedSource: SourceType,
  source: string,
  location: string,
) {
  return values.flatMap((value) => {
    const excerpt = alignExcerptToSource(source, value);
    return excerpt
      ? [{ sourceType: expectedSource, excerpt, location } satisfies MaterialEvidenceSeed]
      : [];
  });
}

function firstSubstantiveExcerpt(source: string, preferredPattern: RegExp) {
  const candidates = source
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter((line) => canonicalCharacter(line).length >= 8)
    .map((line, index) => ({
      line: line.slice(0, 400),
      score:
        Math.min(120, canonicalCharacter(line).length) +
        (preferredPattern.test(line) ? 200 : 0) -
        index * 0.01,
    }))
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.line ?? null;
}

export function groundMaterialOutput(
  output: MaterialModelOutput,
  resumeText: string,
  jdText: string,
) {
  let droppedEvidenceCount = 0;
  let droppedClaimCount = 0;
  let droppedProjectCount = 0;
  let recoveredProjectCount = 0;
  let usedDocumentFallback = false;

  let projects = output.projects.flatMap((project) => {
    let evidence = deduplicateSeeds(
      project.evidence.flatMap((seed) => {
        const grounded = groundedSeed(seed, "resume", resumeText);
        if (!grounded) droppedEvidenceCount += 1;
        return grounded ? [grounded] : [];
      }),
    );
    const groundedClaims = project.confirmedClaims.flatMap((claim) => {
      const grounded = alignExcerptToSource(resumeText, claim);
      if (!grounded) droppedClaimCount += 1;
      return grounded ? [grounded] : [];
    });

    if (evidence.length === 0 && groundedClaims.length > 0) {
      evidence = groundedClaims.slice(0, 3).map((excerpt) => ({
        sourceType: "resume" as const,
        excerpt,
        location: `项目经历 / ${project.name}`.slice(0, 200),
      }));
    }

    // A model may understand a project correctly but paraphrase every quote.
    // Recover from other model fields only when they themselves occur in the
    // extracted resume; the returned evidence is still always source text.
    if (evidence.length === 0) {
      evidence = deduplicateSeeds(
        fallbackSeeds(
          [
            project.name,
            project.context,
            ...project.responsibilities,
            ...project.technologies,
          ],
          "resume",
          resumeText,
          `简历经历 / ${project.name}`.slice(0, 200),
        ),
      ).slice(0, 3);
      if (evidence.length > 0) recoveredProjectCount += 1;
    }

    const confirmedClaims = Array.from(
      new Set([
        ...groundedClaims,
        ...evidence.map((seed) => seed.excerpt.slice(0, 400).trim()),
      ]),
    )
      .filter(Boolean)
      .slice(0, 6);

    if (evidence.length === 0) {
      droppedProjectCount += 1;
      return [];
    }
    return [{ ...project, evidence, confirmedClaims }];
  });

  if (projects.length === 0) {
    const excerpt = firstSubstantiveExcerpt(
      resumeText,
      /项目|实习|科研|研究|负责|开发|模型|系统|算法|API|RAG/iu,
    );
    const basis = output.projects[0];
    if (excerpt && basis) {
      const evidence = [
        {
          sourceType: "resume" as const,
          excerpt,
          location: "简历原文（自动恢复）",
        },
      ];
      projects = [
        {
          ...basis,
          name: alignExcerptToSource(resumeText, basis.name) ?? "简历相关经历",
          context: "PDF 原文已提取，具体经历名称待面试者确认",
          confirmedClaims: [excerpt],
          evidence,
        },
      ];
      usedDocumentFallback = true;
    }
  }

  let jobEvidence = deduplicateSeeds(
    output.job.evidence.flatMap((seed) => {
      const grounded = groundedSeed(seed, "jd", jdText);
      if (!grounded) droppedEvidenceCount += 1;
      return grounded ? [grounded] : [];
    }),
  );
  if (jobEvidence.length === 0) {
    jobEvidence = deduplicateSeeds(
      fallbackSeeds(
        [
          output.job.title,
          ...output.job.responsibilities,
          ...output.job.requiredSkills,
        ],
        "jd",
        jdText,
        "岗位描述",
      ),
    ).slice(0, 8);
  }

  if (jobEvidence.length === 0) {
    const excerpt = firstSubstantiveExcerpt(
      jdText,
      /岗位|职责|要求|能力|开发|算法|工程|模型|数据|系统/iu,
    );
    if (excerpt) {
      jobEvidence = [
        {
          sourceType: "jd" as const,
          excerpt,
          location: "岗位描述（自动恢复）",
        },
      ];
      usedDocumentFallback = true;
    }
  }

  if (projects.length === 0 || jobEvidence.length === 0) return null;

  const repairNotice = [
    droppedEvidenceCount > 0
      ? `${droppedEvidenceCount} 条模型引用无法定位到原文，已自动排除。`
      : "",
    droppedClaimCount > 0
      ? `${droppedClaimCount} 条项目主张无法定位到原文，已自动排除。`
      : "",
    droppedProjectCount > 0
      ? `${droppedProjectCount} 个缺少原文证据的项目草稿未纳入面试。`
      : "",
    recoveredProjectCount > 0
      ? `${recoveredProjectCount} 个项目使用了可定位的名称或技术字段恢复原文证据。`
      : "",
    usedDocumentFallback
      ? "部分结构化引用未能定位，已保留真实文档片段并标记为待确认。"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return MaterialModelOutputSchema.parse({
    ...output,
    projects,
    job: { ...output.job, evidence: jobEvidence },
    excludedUnconfirmedItems: [
      ...(repairNotice ? [repairNotice] : []),
      ...output.excludedUnconfirmedItems,
    ].slice(0, 8),
  });
}
