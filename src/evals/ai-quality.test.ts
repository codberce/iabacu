import { describe, expect, it } from "vitest";
import mathContext from "@/data/exam-text/bac-2026-model-model-oficial.json";
import physicsContext from "@/data/exam-text/fizica/fizica-2026-simulation.json";
import informaticsContext from "@/data/exam-text/informatica/informatica-2026-model-model-oficial.json";
import {
  buildBaremChatPrompt,
  selectBaremChatContext,
} from "@/lib/barem-chat";
import { parseGradeFromText, reconcileGradeResult } from "@/lib/grading";
import type { Exam } from "@/lib/schemas";

type ContextFixture = {
  examId: string;
  subjectText: string;
  baremText: string;
};

type RetrievalCase = {
  name: string;
  context: ContextFixture;
  question: string;
  expectedSubject: RegExp;
  expectedBarem: RegExp;
  rejectedText: RegExp;
  expectedTarget: string;
};

const retrievalCases: RetrievalCase[] = [
  {
    name: "matematică — Subiectul III, 2.b",
    context: mathContext,
    question: "Explică Subiectul III, exercițiul 2.b",
    expectedSubject: /2\.b\)|funcți(?:a|ei)/i,
    expectedBarem: /2\.b\)|punct de inflexiune|grafic/i,
    rejectedText: /SUBIECTUL I[\s\S]{0,400}x\s*=\s*5/i,
    expectedTarget: "Subiectul III, itemul 2.b",
  },
  {
    name: "informatică — heading cu spații, Subiectul III, 3.b",
    context: informaticsContext,
    question: "Explică Subiectul III, exercițiul 3.b",
    expectedSubject: /bac\.txt|programul C\/C\+\+/i,
    expectedBarem: /operații cu fișiere|scriere în fișier/i,
    rejectedText: /20\/25\*20\/2/i,
    expectedTarget: "Subiectul III, itemul 3.b",
  },
  {
    name: "fizică — Optică, Subiectul I, itemul 1",
    context: physicsContext,
    question: "Explică la optică Subiectul I, exercițiul 1",
    expectedSubject: /lentil|optic|imagine/i,
    expectedBarem: /lentil|optic|1\./i,
    rejectedText: /resortul este comprimat/i,
    expectedTarget: "aria D, Subiectul I, itemul 1",
  },
];

describe("AI quality gate — grounded retrieval on official exam corpus", () => {
  it.each(retrievalCases)("$name", (testCase) => {
    const selected = selectBaremChatContext(testCase.context, [
      { role: "user", content: testCase.question },
    ]);

    expect(selected.subjectText).toMatch(testCase.expectedSubject);
    expect(selected.baremText).toMatch(testCase.expectedBarem);
    expect(`${selected.subjectText}\n${selected.baremText}`).not.toMatch(
      testCase.rejectedText,
    );
    expect(selected.grounding?.targetLabel).toBe(testCase.expectedTarget);
    expect(selected.grounding?.subjectPages.length).toBeGreaterThan(0);
    expect(selected.grounding?.baremPages.length).toBeGreaterThan(0);
  });
});

describe("AI quality gate — pedagogical instructions", () => {
  it("includes a single explanation-focused pedagogical approach", () => {
    const prompt = buildBaremChatPrompt(
      evaluationExam,
      mathContext,
      [{ role: "user", content: "Explică Subiectul III, 2.b" }],
    );

    expect(prompt).toContain("Explica rationamentul gradual");
    expect(prompt).toContain("fara salturi importante");
    expect(prompt).toContain("verificarea rezultatului fata de baremul oficial");
    expect(prompt).toContain("Adapteaza nivelul la intrebarea elevului");
  });

  it("does not expose tutoring mode controls in the prompt", () => {
    const prompt = buildBaremChatPrompt(
      evaluationExam,
      mathContext,
      [{ role: "user", content: "Ajută-mă cu Subiectul III, 2.b" }],
    );

    expect(prompt).not.toContain("ADAPTARE AUTOMATA");
    expect(prompt).not.toContain("INDICIU");
    expect(prompt).not.toContain("Mod pedagogic activ:");
  });

  it("includes section marker instructions for structured output", () => {
    const prompt = buildBaremChatPrompt(
      evaluationExam,
      mathContext,
      [{ role: "user", content: "Explică Subiectul III, 2.b" }],
    );

    expect(prompt).toContain("[IDEA]");
    expect(prompt).toContain("[PASI]");
    expect(prompt).toContain("[VERIFICARE]");
    expect(prompt).toContain("[DEFINITIE]");
    expect(prompt).toContain("[ATENTIE]");
    expect(prompt).toContain("[PUNCTAJ]");
  });
});

const evaluationExam: Exam = {
  id: "evaluation-exam",
  subject: "matematica",
  year: 2026,
  order: 0,
  profile: "M_mate-info",
  language: "LRO",
  sessionType: "model",
  sessionLabel: "Evaluare",
  dateLabel: "2026",
  title: "Evaluare AI",
  examPdfPath: "/subject.pdf",
  baremPdfPath: "/barem.pdf",
  contextPath: "context.json",
  sourceKind: "ministry",
  sourceUrl: "https://example.com/subject.pdf",
  baremSourceUrl: "https://example.com/barem.pdf",
  sha256: { exam: "a".repeat(64), barem: "b".repeat(64) },
};

function evaluatedItem(
  section: string,
  item: string,
  maxPoints: number,
) {
  return {
    section,
    item,
    maxPoints,
    awardedPoints: maxPoints,
    feedback: "Corect.",
    confidence: 0.95,
    studentEvidence: "Poza 1: rezolvare vizibilă.",
    rubricEvidence: `Barem: ${maxPoints} puncte.`,
  };
}

describe("AI quality gate — deterministic grading completeness", () => {
  it("accepts only a traceable full-exam breakdown", () => {
    const result = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          totalScore: 10,
          rawPoints: 100,
          confidence: 0.95,
          breakdown: [
            evaluatedItem("Subiectul I", "1", 30),
            evaluatedItem("Subiectul II", "1", 30),
            evaluatedItem("Subiectul III", "1.a", 15),
            evaluatedItem("Subiectul III", "1.b", 15),
            evaluatedItem("Oficiu", "10 puncte", 10),
          ],
          unclearWorkWarnings: [],
          manualReviewNotes: [],
        }),
      ),
      evaluationExam,
    );

    expect(result.reviewRequired).toBe(false);
  });

  it("rejects a plausible total collapsed into one opaque row", () => {
    const result = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          totalScore: 10,
          rawPoints: 100,
          confidence: 0.95,
          breakdown: [evaluatedItem("Examen complet", "toate", 100)],
          unclearWorkWarnings: [],
          manualReviewNotes: [],
        }),
      ),
      evaluationExam,
    );

    expect(result.reviewRequired).toBe(true);
    expect(result.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("puncte din oficiu"),
        expect.stringContaining("defalcare verificabilă"),
        expect.stringContaining("Subiectele I, II și III"),
      ]),
    );
  });
});
