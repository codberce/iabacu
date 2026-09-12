import { z } from "zod";

export const examContextSchema = z.object({ variant: z.string().trim().min(1).max(100).optional(), grade: z.number().int().min(5).max(12).optional(), stage: z.enum(["locala", "judeteana", "nationala"]).optional() });
export type ExamContext = z.infer<typeof examContextSchema>;

export function examContextLabel(context: ExamContext) {
  return [context.variant, context.grade ? `Clasa a ${context.grade}-a` : undefined, context.stage ? ({ locala: "Locală", judeteana: "Județeană", nationala: "Națională" })[context.stage] : undefined].filter(Boolean).join(" · ");
}
