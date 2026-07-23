import { z } from "zod";

export const archiveVersionSchema = z.literal(1);

export const archiveExamTypeSchema = z.enum(["bac", "olympiad"]);

export const examSubjectSchema = z.enum([
  "romana",
  "matematica",
  "istorie",
  "biologie",
  "chimie",
  "fizica",
  "geografie",
  "informatica",
  "logica",
  "psihologie",
  "sociologie",
  "economie",
  "filosofie",
]);

export const archiveDocumentRoleSchema = z.enum([
  "subject",
  "rubric",
  "combined",
]);

export const documentVerificationStatusSchema = z.enum([
  "official-source",
  "verified-copy",
  "verification-pending",
]);

export const archiveExamFormatSchema = z.enum([
  "written",
  "written-proof",
  "multiple-choice",
  "mixed",
]);

export const documentAssetSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().nonnegative().optional(),
  mime: z.literal("application/pdf").optional(),
  pdfObjectKey: z.string().min(1).optional(),
  textObjectKey: z.string().min(1).optional(),
  textSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  pageCount: z.number().int().positive().optional(),
  extraction: z
    .object({
      method: z.enum(["embedded", "ocr", "mixed"]),
      extractedAt: z.string().datetime().optional(),
      ocrLanguage: z.string().min(1).optional(),
    })
    .optional(),
});

export const documentCopySchema = z.object({
  id: z.string().min(1),
  role: archiveDocumentRoleSchema,
  assetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceKind: z.enum(["ministry", "organizer", "vetted-mirror"]),
  issuer: z.string().min(1).optional(),
  sourceUrl: z.string().url(),
  catalogUrl: z.string().url().optional(),
  downloadedAt: z.string().datetime().optional(),
  language: z.string().min(1),
  variantId: z.string().min(1).optional(),
  size: z.number().int().nonnegative().optional(),
  pageCount: z.number().int().positive().optional(),
  textPath: z.string().min(1).optional(),
  pdfPath: z.string().min(1).optional(),
  verificationStatus: documentVerificationStatusSchema,
});

export const documentReferenceSchema = z.object({
  primaryCopyId: z.string().min(1).optional(),
  copies: z.array(documentCopySchema).default([]),
});

export const documentSetSchema = z.object({
  subject: documentReferenceSchema.optional(),
  rubric: documentReferenceSchema.optional(),
  combined: documentReferenceSchema.optional(),
  combinedPageRanges: z
    .object({
      subject: z.array(z.tuple([z.number().int().positive(), z.number().int().positive()])),
      rubric: z.array(z.tuple([z.number().int().positive(), z.number().int().positive()])),
    })
    .optional(),
});

export const canonicalExamSchema = z.object({
  id: z.string().min(1),
  type: archiveExamTypeSchema,
  subject: examSubjectSchema,
  year: z.number().int().min(2010).max(2100),
  sessionType: z.enum([
    "model",
    "simulation",
    "special",
    "final",
    "reserve",
    "autumn",
  ]),
  sessionLabel: z.string().min(1),
  dateLabel: z.string().min(1),
  title: z.string().min(1),
  profile: z.string().min(1),
  language: z.literal("LRO"),
  order: z.number().int().nonnegative(),
  durationMinutes: z.number().int().min(15).max(360).optional(),
  format: archiveExamFormatSchema.optional(),
  contextPath: z.string().min(1).optional(),
  olympiad: z
    .object({
      grade: z.number().int().min(5).max(12),
      stage: z.enum(["locala", "judeteana", "nationala"]),
      geographicScope: z.enum(["county", "national", "shared"]),
      county: z.string().min(1).optional(),
      variantId: z.string().min(1),
    })
    .optional(),
  documents: documentSetSchema,
});

export const archiveAliasSchema = z.object({
  fromId: z.string().min(1),
  canonicalId: z.string().min(1),
  reason: z.enum([
    "binary-identical",
    "content-equivalent",
    "renamed",
    "legacy-route",
  ]),
  decidedAt: z.string().date(),
});

export const bacManifestSchema = z.object({
  version: archiveVersionSchema,
  generatedAt: z.string().datetime(),
  assetStorage: z.enum(["legacy", "r2"]).default("legacy"),
  assetBaseUrl: z.string().url().nullable().default(null),
  assets: z.array(documentAssetSchema),
  exams: z.array(canonicalExamSchema),
  aliases: z.array(archiveAliasSchema),
});

export type ArchiveDocumentRole = z.infer<typeof archiveDocumentRoleSchema>;
export type DocumentVerificationStatus = z.infer<
  typeof documentVerificationStatusSchema
>;
export type DocumentAsset = z.infer<typeof documentAssetSchema>;
export type DocumentCopy = z.infer<typeof documentCopySchema>;
export type DocumentSet = z.infer<typeof documentSetSchema>;
export type CanonicalExam = z.infer<typeof canonicalExamSchema>;
export type ArchiveAlias = z.infer<typeof archiveAliasSchema>;
export type BacManifest = z.infer<typeof bacManifestSchema>;
