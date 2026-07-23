import { z } from "zod";

export const sessionTypeSchema = z.enum([
  "model",
  "simulation",
  "special",
  "final",
  "reserve",
  "autumn",
]);

const pdfLocationSchema = z.string().refine(
  (value) =>
    value.startsWith("/") ||
    (() => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    })(),
  "PDF location must be an absolute path or HTTP(S) URL",
);

const httpUrlSchema = z.string().refine(
  (value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  },
  "Platform URL must be an absolute HTTP(S) URL",
);

export const examCategorySchema = z.enum(["bac", "evaluare-nationala", "olympiad"]);

export const examSchema = z.object({
  id: z.string().min(1),
  category: examCategorySchema.optional(),
  subject: z
    .enum(["romana", "matematica", "istorie", "biologie", "chimie", "fizica", "geografie", "informatica", "logica", "psihologie", "sociologie", "economie", "filosofie"])
    .default("matematica"),
  year: z.number().int().min(1900).max(2100),
  order: z.number().int().nonnegative(),
  profile: z.string().min(1),
  language: z.literal("LRO"),
  sessionType: sessionTypeSchema,
  sessionLabel: z.string().min(1),
  dateLabel: z.string().min(1),
  title: z.string().min(1),
  examPdfPath: pdfLocationSchema,
  baremPdfPath: pdfLocationSchema,
  contextPath: z.string().startsWith("src/data/exam-text/"),
  sourceKind: z.enum(["ministry", "vetted-mirror"]),
  sourceUrl: z.string().min(1),
  baremSourceUrl: z.string().min(1),
  sha256: z.object({
    exam: z.string().regex(/^[a-f0-9]{64}$/),
    barem: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  verification: z.object({
    subject: z.enum(["official-source", "verified-copy", "verification-pending"]),
    barem: z.enum(["official-source", "verified-copy", "verification-pending"]),
  }).optional(),
  durationMinutes: z.number().int().positive().optional(),
  format: z.string().min(1).optional(),
  olympiadSubject: z.string().min(1).optional(),
  platform: z.object({
    provider: z.enum(["kilonova", "mlcompete", "cyberedu"]),
    url: httpUrlSchema,
  }).optional(),
});

export const gradeBreakdownItemSchema = z
  .object({
    section: z.string().trim().min(1),
    item: z.string().trim().min(1),
    maxPoints: z.number().min(0).max(100),
    awardedPoints: z.number().min(0).max(100),
    feedback: z.string().trim().min(1),
    studentEvidence: z.string().trim().min(1).optional(),
    rubricEvidence: z.string().trim().min(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .refine((item) => item.awardedPoints <= item.maxPoints, {
    message: "Punctajul acordat nu poate depăși punctajul maxim.",
    path: ["awardedPoints"],
  });

export const gradeResultSchema = z.object({
  totalScore: z.number().min(1).max(10),
  rawPoints: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  breakdown: z.array(gradeBreakdownItemSchema).min(1).max(120),
  unclearWorkWarnings: z.array(z.string()).default([]),
  manualReviewNotes: z.array(z.string()).default([]),
  reviewRequired: z.boolean().optional(),
  reviewReasons: z.array(z.string()).optional(),
  model: z.string().trim().min(1).optional(),
  pipelineVersion: z.string().trim().min(1).optional(),
});

export const attemptRecordSchema = z.object({
  id: z.string().min(1),
  examId: z.string().min(1),
  score: z.number().min(1).max(10),
  createdAt: z.string().datetime(),
  source: z.literal("ai"),
  gradeResult: gradeResultSchema,
});

export const attemptStoreSchema = z.object({
  version: z.literal(1),
  attempts: z.array(attemptRecordSchema),
});

export type Exam = z.infer<typeof examSchema>;
export type ExamSessionType = z.infer<typeof sessionTypeSchema>;
export type GradeResult = z.infer<typeof gradeResultSchema>;
export type AttemptRecord = z.infer<typeof attemptRecordSchema>;
export type AttemptStore = z.infer<typeof attemptStoreSchema>;
