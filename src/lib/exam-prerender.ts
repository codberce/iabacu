import type { Exam } from "@/lib/schemas";

export const MAX_PRERENDERED_EXAMS = 256;

export function getPrerenderedExamParams(exams: readonly Exam[]) {
  const nationalExams = exams.filter((exam) => !exam.olympiadSubject);
  const latestYear = Math.max(...nationalExams.map((exam) => exam.year));
  return nationalExams
    .filter((exam) => exam.year >= latestYear - 1)
    .toSorted((a, b) => b.year - a.year || a.order - b.order)
    .slice(0, MAX_PRERENDERED_EXAMS)
    .map((exam) => ({ examId: exam.id }));
}
