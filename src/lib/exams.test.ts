import { describe, expect, it } from "vitest";
import {
  exams,
  examsBySubject,
  getCanonicalExamId,
  getExamById,
  groupExamsByYear,
  informaticsExams,
  mathematicsExams,
  physicsExams,
  romanianExams,
} from "./exams";
import type { Exam } from "./schemas";

const baseExam: Exam = {
  id: "a",
  subject: "matematica",
  year: 2026,
  order: 1,
  profile: "M_mate-info",
  language: "LRO",
  sessionType: "model",
  sessionLabel: "Model oficial",
  dateLabel: "2026",
  title: "Model oficial 2026",
  examPdfPath: "/exams/2026/a.pdf",
  baremPdfPath: "/exams/2026/b.pdf",
  contextPath: "src/data/exam-text/a.json",
  sourceKind: "ministry",
  sourceUrl: "https://example.com/a.pdf",
  baremSourceUrl: "https://example.com/b.pdf",
  sha256: {
    exam: "a".repeat(64),
    barem: "b".repeat(64),
  },
};

describe("exam manifest helpers", () => {
  it("groups exams by descending year", () => {
    const grouped = groupExamsByYear([
      { ...baseExam, id: "2025", year: 2025, order: 2 },
      { ...baseExam, id: "2026", year: 2026, order: 1 },
    ]);

    expect(grouped.map((group) => group.year)).toEqual([2026, 2025]);
  });

  it("loads the generated official manifest", () => {
    expect(mathematicsExams.length).toBeGreaterThanOrEqual(40);
    expect(romanianExams.length).toBeGreaterThan(0);
    expect(physicsExams.length).toBeGreaterThan(0);
    expect(informaticsExams.length).toBeGreaterThan(0);
    expect(new Set(exams.map((exam) => exam.id)).size).toBe(exams.length);
    expect(
      exams.every((exam) => exam.platform || exam.baremPdfPath.endsWith(".pdf")),
    ).toBe(true);
  });

  it("includes the 2026 June-July final papers for every supported subject", () => {
    const archiveSubjects = [
      "istorie", "biologie", "chimie", "economie", "filosofie", "geografie",
      "logica", "psihologie", "sociologie",
    ] as const;

    for (const subject of archiveSubjects) {
      expect(examsBySubject[subject]?.some((exam) => exam.year === 2026 && exam.sessionType === "final")).toBe(true);
    }
    expect(physicsExams.some((exam) => exam.year === 2026 && exam.sessionType === "final")).toBe(true);
    expect(informaticsExams.some((exam) => exam.year === 2026 && exam.sessionType === "final")).toBe(true);
    expect(romanianExams.some((exam) => exam.year === 2026 && exam.sessionType === "final")).toBe(true);
    expect(mathematicsExams.some((exam) => exam.year === 2026 && exam.sessionType === "final")).toBe(true);
  });

  it("does not expose General as a variant where a subject has real variants", () => {
    const subjectsWithVariants = ["biologie", "fizica", "informatica", "matematica", "romana"] as const;

    for (const subject of subjectsWithVariants) {
      expect(examsBySubject[subject]?.some((exam) => exam.profile === "General")).toBe(false);
    }
  });

  it("keeps one canonical page for verified duplicate PDFs", () => {
    expect(getCanonicalExamId("archive-logica-872")).toBe("archive-logica-143");
    expect(getExamById("archive-logica-872")?.id).toBe("archive-logica-143");
    expect(exams.some((exam) => exam.id === "archive-logica-872")).toBe(false);
  });
});
