import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { curatedExercises, exercisesForTopic, practiceTopics } from "./practice-topics";
import { getExamById } from "./exams";
import { getExamVariants } from "./exam-variants";
import katex from "katex";
const reviewedHashes = {
  "bac-2026-model-model-oficial": {
    "exam": "afefbfe1ec6ca0ed8eb342692f265fd2740cab85e197e188b3979a1522224714",
    "barem": "6360867d159a71cc0cd912ad441c8d9de852633058c05e541c5c8f04b3c99950"
  },
  "bac-2025-model-model-oficial": {
    "exam": "966b3cbd92153e456f54a4596f4424e310f7b73b301a721fa5291fab716f5441",
    "barem": "45e839ea3667c1ca59ae8b4e1216b123f152dfcb922d3270c72d39b2c6eb662f"
  },
  "bac-2024-model-model-oficial": {
    "exam": "3454f58b11f6cafbf64ef053a9f14ae2d2f47c62f302c4e3c90a673c6cd1cc73",
    "barem": "a8a0d7ae15e999addc61a6d03bfd96cadbff1979cd4f2f8e17d8420fe3e7bdfe"
  }
};

describe("curated official practice", () => {
  it("offers three distinct grounded exercises per topic, all from Mate-Info", () => {
    expect(new Set(curatedExercises.map((item) => item.id)).size).toBe(12);
    for (const topic of practiceTopics) {
      const set = exercisesForTopic(topic.id);
      expect(set).toHaveLength(3);
      for (const item of set) {
        const exam = getExamById(item.examId)!;
        expect(exam).toBeDefined(); expect(getExamVariants(exam)).toEqual(["Mate-Info"]);
        expect(item.reference).toBe(`Subiectul I · ${topic.item}`);
        expect([...item.rubric.matchAll(/\*\*(\d)p\*\*/g)].reduce((sum, match) => sum + Number(match[1]), 0)).toBe(5);
        for (const match of `${item.statement} ${item.rubric}`.matchAll(/\$([^$]+)\$/g)) expect(() => katex.renderToString(match[1], { throwOnError: true })).not.toThrow();
      }
    }
  });
  it("keeps the checked transcription sources tied to the official PDF hashes", () => {
    for (const year of [2024, 2025, 2026]) {
      const exam = getExamById(`bac-${year}-model-model-oficial`)!;
      for (const [kind, suffix] of [["exam", "subiect"], ["barem", "barem"]] as const) {
        expect(exam.sha256[kind]).toBe(reviewedHashes[exam.id as keyof typeof reviewedHashes][kind]);
        const path = `public/exams/${year}/bac-${year}-model-model-oficial-${suffix}.pdf`;
        if (!existsSync(path)) continue; // The offline asset pack is installed separately.
        const bytes = readFileSync(path);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(exam.sha256[kind]);
      }
    }
  });
});
