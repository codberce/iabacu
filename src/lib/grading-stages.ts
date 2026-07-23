import { z } from "zod";
import type { GradeResult } from "@/lib/schemas";

export const transcriptionStageSchema = z.object({
  pages: z.array(z.object({
    workPageId: z.string().min(1),
    order: z.number().int().positive(),
    detectedPageNumber: z.number().int().positive().optional(),
    text: z.string().trim().min(1),
    unclearRegions: z.array(z.string().trim().min(1)).default([]),
    probableExerciseLabels: z.array(z.string().trim().min(1)).default([]),
  })).min(1).max(8),
});

export const identificationStageSchema = z.object({
  items: z.array(z.object({
    section: z.string().trim().min(1),
    item: z.string().trim().min(1),
    workPageIds: z.array(z.string().trim().min(1)).min(1),
    reviewRequired: z.boolean().default(false),
    reviewReasons: z.array(z.string().trim().min(1)).default([]),
  })).min(1).max(120),
});

export type WorkPageTranscription = z.infer<
  typeof transcriptionStageSchema
>["pages"][number];
export type ExerciseIdentification = z.infer<
  typeof identificationStageSchema
>["items"][number];

export const itemGradeStageSchema = z.object({
  section: z.string().trim().min(1),
  item: z.string().trim().min(1),
  maxPoints: z.number().min(0).max(100),
  awardedPoints: z.number().min(0).max(100),
  feedback: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  studentEvidenceRef: z.object({
    workPageId: z.string().trim().min(1),
    order: z.number().int().positive(),
    page: z.number().int().positive().optional(),
    quotation: z.string().trim().min(1),
  }),
  rubricEvidenceRef: z.object({
    documentId: z.literal("rubric"),
    page: z.number().int().positive(),
    item: z.string().trim().min(1),
    quotation: z.string().trim().min(1),
  }),
}).refine((item) => item.awardedPoints <= item.maxPoints, {
  message: "Punctajul acordat depășește punctajul maxim.",
});

export function validateTranscriptions(
  value: unknown,
  pages: { workPageId: string; order: number }[],
): WorkPageTranscription[] {
  const parsed = transcriptionStageSchema.parse(value).pages;
  const expected = new Map(pages.map((page) => [page.workPageId, page.order]));
  if (parsed.length !== expected.size || new Set(parsed.map((page) => page.workPageId)).size !== expected.size) {
    throw new Error("Transcrierea trebuie să acopere fiecare pagină exact o dată.");
  }
  for (const page of parsed) {
    if (expected.get(page.workPageId) !== page.order) throw new Error("Transcrierea conține un identificator sau o ordine de pagină invalidă.");
  }
  return parsed;
}

export function validateIdentification(
  value: unknown,
  transcriptions: WorkPageTranscription[],
): ExerciseIdentification[] {
  const parsed = identificationStageSchema.parse(value).items;
  const knownPages = new Set(transcriptions.map((page) => page.workPageId));
  const seen = new Set<string>();
  for (const item of parsed) {
    const key = `${item.section.toLocaleLowerCase("ro")}:${item.item.toLocaleLowerCase("ro")}`;
    if (seen.has(key)) throw new Error("Identificarea conține itemi duplicati.");
    seen.add(key);
    if (item.workPageIds.some((page) => !knownPages.has(page))) throw new Error("Identificarea citează o pagină care nu a fost transcrisă.");
  }
  return parsed;
}

export function validateItemGrade(value: unknown): GradeResult["breakdown"][number] {
  return itemGradeStageSchema.parse(value);
}
