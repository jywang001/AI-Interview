import { z } from "zod";
import { EvidenceReferenceSchema, RoleIdSchema } from "@/lib/interview/schemas";

export const MAX_RESUME_BYTES = 8 * 1024 * 1024;
export const MAX_RESUME_TEXT_CHARS = 60_000;
export const MIN_JD_CHARS = 20;
export const MAX_JD_CHARS = 12_000;

export const MaterialEvidenceSeedSchema = z
  .object({
    sourceType: z.enum(["resume", "jd"]),
    excerpt: z.string().min(1).max(1_000),
    location: z.string().min(1).max(200),
  })
  .strict();

export const MaterialModelOutputSchema = z
  .object({
    displayName: z.string().min(1).max(80),
    headline: z.string().min(1).max(240),
    education: z.array(z.string().min(1).max(300)).max(8),
    experienceHighlights: z.array(z.string().min(1).max(400)).max(10),
    projects: z
      .array(
        z
          .object({
            name: z.string().min(1).max(160),
            context: z.string().min(1).max(500),
            responsibilities: z.array(z.string().min(1).max(300)).min(1).max(8),
            technologies: z.array(z.string().min(1).max(80)).min(1).max(16),
            confirmedClaims: z.array(z.string().min(1).max(400)).min(1).max(10),
            evidence: z.array(MaterialEvidenceSeedSchema).min(1).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    skills: z.array(z.string().min(1).max(80)).min(1).max(24),
    job: z
      .object({
        title: z.string().min(1).max(160),
        companyLabel: z.string().min(1).max(160).nullable(),
        responsibilities: z.array(z.string().min(1).max(300)).min(1).max(10),
        requiredSkills: z.array(z.string().min(1).max(200)).min(1).max(12),
        preferredSkills: z.array(z.string().min(1).max(200)).max(10),
        constraints: z.array(z.string().min(1).max(240)).max(10),
        evidence: z.array(MaterialEvidenceSeedSchema).min(1).max(8),
      })
      .strict(),
    matchHighlights: z.array(z.string().min(1).max(300)).min(1).max(8),
    verificationRisks: z.array(z.string().min(1).max(300)).max(8),
    excludedUnconfirmedItems: z.array(z.string().min(1).max(300)).max(8),
  })
  .strict();

export const DraftEvidenceReferenceSchema = EvidenceReferenceSchema.refine(
  (reference) =>
    (reference.sourceType === "resume" || reference.sourceType === "jd") &&
    reference.confirmed === false &&
    reference.revisionId === null &&
    reference.startOffset === null &&
    reference.endOffset === null,
  { message: "Material draft evidence must be unconfirmed resume or JD evidence." },
);

const MaterialProjectDraftSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    context: z.string().min(1),
    responsibilities: z.array(z.string().min(1)).min(1),
    technologies: z.array(z.string().min(1)).min(1),
    confirmedClaims: z.array(z.string().min(1)).min(1),
    evidenceRefs: z.array(DraftEvidenceReferenceSchema).min(1),
  })
  .strict();

const MaterialJobDraftSchema = z
  .object({
    title: z.string().min(1),
    companyLabel: z.string().min(1).nullable(),
    responsibilities: z.array(z.string().min(1)).min(1),
    requiredSkills: z.array(z.string().min(1)).min(1),
    preferredSkills: z.array(z.string().min(1)),
    constraints: z.array(z.string().min(1)),
    evidenceRefs: z.array(DraftEvidenceReferenceSchema).min(1),
  })
  .strict();

export const MaterialAnalysisDraftSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    roleId: RoleIdSchema,
    headline: z.string().min(1),
    education: z.array(z.string().min(1)),
    experienceHighlights: z.array(z.string().min(1)),
    projects: z.array(MaterialProjectDraftSchema).min(1),
    skills: z.array(z.string().min(1)).min(1),
    job: MaterialJobDraftSchema,
    matchHighlights: z.array(z.string().min(1)).min(1),
    verificationRisks: z.array(z.string().min(1)),
    excludedUnconfirmedItems: z.array(z.string().min(1)),
    sourceEvidenceRefs: z.array(DraftEvidenceReferenceSchema).min(2),
    generatedAt: z.string().datetime({ offset: true }),
    providerMode: z.enum(["live", "demo"]),
  })
  .strict();

export const MaterialParseMetaSchema = z
  .object({
    requestId: z.string().min(1),
    resumeFileName: z.string().min(1),
    resumeCharacterCount: z.number().int().nonnegative(),
    jdCharacterCount: z.number().int().nonnegative(),
    extractionMethod: z.literal("pdftotext"),
    model: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const MaterialParseErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "REQUEST_TOO_LARGE",
  "RATE_LIMITED",
  "PDF_EXTRACTION_UNAVAILABLE",
  "PDF_EXTRACTION_FAILED",
  "PDF_TEXT_EMPTY",
  "MODEL_NOT_CONFIGURED",
  "MODEL_UNAVAILABLE",
  "MODEL_OUTPUT_INVALID",
  "EVIDENCE_NOT_GROUNDED",
]);

export const MaterialParseSuccessSchema = z
  .object({
    ok: z.literal(true),
    draft: MaterialAnalysisDraftSchema,
    meta: MaterialParseMetaSchema,
  })
  .strict();

export const MaterialParseErrorSchema = z
  .object({
    ok: z.literal(false),
    code: MaterialParseErrorCodeSchema,
    message: z.string().min(1),
    recoverable: z.boolean(),
    requestId: z.string().min(1),
  })
  .strict();

export const MaterialParseResponseSchema = z.discriminatedUnion("ok", [
  MaterialParseSuccessSchema,
  MaterialParseErrorSchema,
]);

export type MaterialEvidenceSeed = z.infer<typeof MaterialEvidenceSeedSchema>;
export type MaterialModelOutput = z.infer<typeof MaterialModelOutputSchema>;
export type MaterialAnalysisDraft = z.infer<typeof MaterialAnalysisDraftSchema>;
export type MaterialParseSuccess = z.infer<typeof MaterialParseSuccessSchema>;
export type MaterialParseError = z.infer<typeof MaterialParseErrorSchema>;
export type MaterialParseResponse = z.infer<typeof MaterialParseResponseSchema>;
