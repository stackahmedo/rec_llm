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
  // Extended metadata
  originalFileName: z.string().max(500).optional(),
  generatedFileName: z.string().max(500).optional(),
  displayName: z.string().max(500).optional(),
  fileExtension: z.string().max(20).optional(),
  duration: z.number().min(0).optional(),
  sourcePath: z.string().max(2000).optional(),
  storagePath: z.string().max(2000).optional(),
  transcriptId: z.string().max(200).optional(),
  jobId: z.string().max(200).optional(),
  uploadedAt: z.string().max(100).optional(),
  processedAt: z.string().max(100).optional(),
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

// --- Audio / Long-Audio schemas ---

export const filePathSchema = z.string().min(1).max(4096);

export const pipelineIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_\-]+$/);

export const chunkIndexSchema = z.number().int().min(0).max(100_000);

export const chunkMinutesSchema = z.number().int().min(1).max(1440).optional();

export const longAudioStartOptsSchema = z.object({
  concurrency: z.number().int().min(1).max(10).optional(),
}).optional();

export const chunkDoneUtterancesSchema = z.array(z.object({
  speaker: z.string().max(500).optional(),
  text: z.string().max(100_000).optional(),
  start: z.number().min(0).optional(),
  end: z.number().min(0).optional(),
  startMs: z.number().min(0).optional(),
  endMs: z.number().min(0).optional(),
  confidence: z.number().min(0).max(1).optional(),
}).passthrough()).max(100_000);

export const chunkFailedErrorSchema = z.string().min(1).max(10_000);

// --- PDF export schemas ---

export const pdfExportDataSchema = z.object({
  fileName: z.string().min(1).max(500),
  processedAt: z.string().min(1).max(100),
  languageCode: z.string().min(1).max(20),
  summary: z.string().max(100_000).optional(),
  pointNotes: z.array(z.string().max(10_000)).max(500).optional(),
  actionItems: z.array(z.string().max(10_000)).max(500).optional(),
  decisions: z.array(z.string().max(10_000)).max(500).optional(),
  risks: z.array(z.string().max(10_000)).max(500).optional(),
  utterances: z.array(z.object({
    speaker: z.string().max(500),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    text: z.string().max(100_000),
  })).max(100_000).optional(),
  config: z.any().optional(),
});

// --- AssemblyAI schemas ---

export const transcribeFileSchema = z.object({
  filePath: filePathSchema,
  jobId: z.string().min(1).max(200),
});

// --- Document schemas ---

export const documentIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_\-\.]+$/);
