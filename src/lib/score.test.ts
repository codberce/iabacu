import { describe, expect, it } from "vitest";
import { bestAttemptForExam, clampScore, formatScore, scoreBand } from "./score";

const gradeResult = {
  totalScore: 9.25,
  rawPoints: 92.5,
  confidence: 0.9,
  breakdown: [
    {
      section: "Subiectul I",
      item: "1",
      maxPoints: 5,
      awardedPoints: 5,
      feedback: "Corect.",
    },
  ],
  unclearWorkWarnings: [],
  manualReviewNotes: [],
};

describe("score helpers", () => {
  it("maps scores to the requested bands", () => {
    expect(scoreBand(9.5).key).toBe("dark-green");
    expect(scoreBand(9).key).toBe("light-green");
    expect(scoreBand(8).key).toBe("yellow");
    expect(scoreBand(7).key).toBe("orange");
    expect(scoreBand(6.99).key).toBe("red");
    expect(scoreBand(undefined).key).toBe("neutral");
  });

  it("formats and clamps scores", () => {
    expect(formatScore(9)).toBe("9.00");
    expect(clampScore(10.25)).toBe(10);
    expect(clampScore(0.4)).toBe(1);
    expect(clampScore(8.678)).toBe(8.68);
  });

  it("selects the best attempt for an exam", () => {
    const attempts = [
      {
        id: "a",
        examId: "exam",
        score: 7,
        createdAt: "2026-01-01T00:00:00.000Z",
        source: "ai" as const,
        gradeResult: { ...gradeResult, totalScore: 7, rawPoints: 70 },
      },
      {
        id: "b",
        examId: "exam",
        score: 9.25,
        createdAt: "2026-01-02T00:00:00.000Z",
        source: "ai" as const,
        gradeResult,
      },
    ];

    expect(bestAttemptForExam("exam", attempts)?.id).toBe("b");
  });
});
