import { z } from "zod";

export const MAX_TRANSCRIPTION_AUDIO_BYTES = 5 * 1024 * 1024;

export const SpeechLocaleSchema = z.enum(["zh-CN", "en-US"]);
export const SpeechRequestIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);

export const VolcSttSuccessResponseSchema = z
  .object({
    audio_info: z
      .object({
        duration: z.number().int().nonnegative(),
      })
      .passthrough(),
    result: z
      .object({
        text: z.string(),
        additions: z
          .object({
            duration: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const TranscriptionResultSchema = z
  .object({
    requestId: z.string().min(1),
    rawText: z.string().min(1),
    provider: z.string().min(1),
    durationMs: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const SpeechTranscribeErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "REQUEST_TOO_LARGE",
  "UNSUPPORTED_AUDIO",
  "NO_SPEECH",
  "STT_NOT_CONFIGURED",
  "STT_TIMEOUT",
  "STT_BUSY",
  "STT_UNAVAILABLE",
  "STT_RESPONSE_INVALID",
]);

export const SpeechTranscribeErrorSchema = z
  .object({
    ok: z.literal(false),
    code: SpeechTranscribeErrorCodeSchema,
    message: z.string().min(1),
    recoverable: z.boolean(),
    requestId: z.string().min(1),
  })
  .strict();

export type SpeechLocale = z.infer<typeof SpeechLocaleSchema>;
export type SpeechTranscribeError = z.infer<
  typeof SpeechTranscribeErrorSchema
>;
