import { describe, expect, it } from "vitest";
import { getPrerenderedExamParams, MAX_PRERENDERED_EXAMS } from "./exam-prerender";
import type { Exam } from "./schemas";

describe("deployment prerender budget", () => {
  it("bounds output even when the archive gains many recent documents", () => {
    const exams = Array.from({ length: 800 }, (_, index) => ({ id: `recent-${index}`, year: 2026, order: index }) as Exam);
    expect(getPrerenderedExamParams(exams)).toHaveLength(MAX_PRERENDERED_EXAMS);
    expect(getPrerenderedExamParams(exams)[0]).toEqual({ examId: "recent-0" });
  });

  it("prerenders recent national papers while leaving old and olympiad documents on demand", () => {
    const exams = [
      { id: "new", year: 2026, order: 0 },
      { id: "previous", year: 2025, order: 1 },
      { id: "older", year: 2024, order: 2 },
      { id: "olympiad", year: 2027, order: 0, olympiadSubject: "matematica" },
    ] as Exam[];
    expect(getPrerenderedExamParams(exams)).toEqual([{ examId: "new" }, { examId: "previous" }]);
    expect(getPrerenderedExamParams([])).toEqual([]);
  });
});
