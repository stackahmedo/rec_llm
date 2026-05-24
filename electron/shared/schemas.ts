import { z } from 'zod';

const utteranceSchema = z.object({
  speaker: z.string().max(500),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string().max(100_000),
});

const utteranceInputSchema = z.object({
  speaker: z.string().max(500),
  startMs: z.number().int().min(0),
  text: z.string().max(100_000),
});

export const historyJobSchema = z.object({
  id: z.string().min(1).max(200),
  fileName: z.string().min(1).max(500),
  filePath: z.string().min(1).max(2000),
  sizeBytes: z.number().int().min(0),
  status: z.enum(['done', 'failed']),
  languageCode: z.string().min(1).max(20),
  speakerCount: z.number().int().min(0).max(1000),
  createdAt: z.string().min(1).max(100),
  completedAt: z.string().min(1).max(100),
  pdfPath: z.string().max(2000).optional(),
  transcript: z.object({
    fullText: z.string().max(50_000_000),
    utterances: z.array(utteranceSchema).max(100_000),
  }).optional(),
  summary: z.object({
    language: z.string().max(20),
    summary: z.string().max(100_000),
    pointNotes: z.array(z.string().max(10_000)).max(500),
    actionItems: z.array(z.string().max(10_000)).max(500),
    decisions: z.array(z.string().max(10_000)).max(500),
    risks: z.array(z.string().max(10_000)).max(500),
    generatedAt: z.string().max(100),
  }).optional(),
});

export const summarizeRequestSchema = z.object({
  transcript: z.string().min(1).max(50_000_000),
  utterances: z.array(utteranceInputSchema).max(100_000).optional(),
  language: z.enum(['en', 'ja']),
});

export const exportDocxSchema = z.object({
  utterances: z.array(utteranceInputSchema).max(100_000),
  languageCode: z.string().min(1).max(20),
  summary: z.string().max(100_000).optional(),
  pointNotes: z.array(z.string().max(10_000)).max(500).optional(),
});

export const idSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_\-\.]+$/);

export const settingsKeySchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9._\-]+$/);

export const fileNameSchema = z.string().min(1).max(500);

export const exportTxtSchema = z.object({
  fileName: fileNameSchema,
  content: z.string().min(1).max(50_000_000),
});

export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const firstIssue = result.error.issues[0];
  const path = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : '';
  return { ok: false, error: `Validation failed — ${path}${firstIssue.message}` };
}
