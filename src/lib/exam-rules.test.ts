import { describe, expect, it } from "vitest";
import { examDurationMinutes, examFormatLabel } from "@/lib/exam-rules";
import type { Exam } from "@/lib/schemas";

const exam = { durationMinutes: undefined, format: undefined } as Exam;

describe("exam rules", () => {
  it("defaults Bac sessions to three hours", () => {
    expect(examDurationMinutes(exam)).toBe(180);
  });
  it("uses competition-specific duration and format", () => {
    expect(examDurationMinutes({ ...exam, durationMinutes: 240 })).toBe(240);
    expect(examFormatLabel({ ...exam, format: "written-proof" })).toBe("Redactare completă");
  });
});
