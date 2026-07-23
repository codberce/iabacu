import { describe, expect, it } from "vitest";
import { getExamVariants, subjectVariants } from "./exam-variants";
import type { Exam } from "./schemas";

const exam = (subject: Exam["subject"], profile: string) => ({ subject, profile }) as Exam;

describe("canonical exam variants", () => {
  it("publishes only the four official mathematics choices", () => {
    expect(subjectVariants.matematica).toEqual([
      "Mate-Info", "Științele Naturii", "Tehnologic", "Pedagogic",
    ]);
  });

  it("maps historical mathematics names to current choices", () => {
    expect(getExamVariants(exam("matematica", "M1"))).toEqual(["Mate-Info"]);
    expect(getExamVariants(exam("matematica", "M2"))).toEqual(["Științele Naturii", "Tehnologic"]);
    expect(getExamVariants(exam("matematica", "M4"))).toEqual(["Pedagogic"]);
  });

  it("maps shared historical physics papers to both official choices", () => {
    expect(getExamVariants(exam("fizica", "Real · Tehnologic · Militar"))).toEqual([
      "Teoretic/Vocațional", "Tehnologic",
    ]);
  });
});
