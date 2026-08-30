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

export function groundMaterialOutput(
  output: MaterialModelOutput,
  resumeText: string,
  jdText: string,
) {
  let droppedEvidenceCount = 0;
  let droppedClaimCount = 0;
  let droppedProjectCount = 0;

  const projects = output.projects.flatMap((project) => {
    let evidence = deduplicateSeeds(
      project.evidence.flatMap((seed) => {
        const grounded = groundedSeed(seed, "resume", resumeText);
        if (!grounded) droppedEvidenceCount += 1;
        return grounded ? [grounded] : [];
      }),
    );
    let confirmedClaims = project.confirmedClaims.flatMap((claim) => {
      const grounded = alignExcerptToSource(resumeText, claim);
      if (!grounded) droppedClaimCount += 1;
      return grounded ? [grounded] : [];
    });

    if (evidence.length === 0 && confirmedClaims.length > 0) {
      evidence = confirmedClaims.slice(0, 3).map((excerpt) => ({
        sourceType: "resume" as const,
        excerpt,
        location: `项目经历 / ${project.name}`.slice(0, 200),
      }));
    }
    if (confirmedClaims.length === 0 && evidence.length > 0) {
      confirmedClaims = evidence
        .map((seed) => seed.excerpt.slice(0, 400).trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    if (evidence.length === 0 || confirmedClaims.length === 0) {
      droppedProjectCount += 1;
      return [];
    }
    return [{ ...project, evidence, confirmedClaims }];
  });

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
