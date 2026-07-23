import type { Exam } from "@/lib/schemas";

export const DEFAULT_EXAM_DURATION_MINUTES = 180;

export function examDurationMinutes(exam: Exam): number {
  return exam.durationMinutes ?? DEFAULT_EXAM_DURATION_MINUTES;
}

export function examDurationSeconds(exam: Exam): number {
  return examDurationMinutes(exam) * 60;
}

export function examFormatLabel(exam: Exam): string {
  switch (exam.format) {
    case "written-proof":
      return "Redactare completă";
    case "multiple-choice":
      return "Grilă";
    case "mixed":
      return "Format mixt";
    default:
      return "Probă scrisă";
  }
}
