import { describe, expect, it } from "vitest";
import { buildOlympiadBaremChatPayload } from "./olympiad-barem-chat";
import type { Exam } from "./schemas";

const exam: Exam = {
  id: "olympiad:test",
  subject: "matematica",
  year: 2026,
  order: 0,
  profile: "Clasa a IX-a",
  language: "LRO",
  sessionType: "model",
  sessionLabel: "Olimpiadă",
  dateLabel: "2026",
  title: "Olimpiadă 2026",
  examPdfPath: "/subject.pdf",
  baremPdfPath: "/solutions.pdf",
  contextPath: "context.json",
  sourceKind: "ministry",
  sourceUrl: "https://example.com/subject.pdf",
  baremSourceUrl: "https://example.com/solutions.pdf",
  sha256: { exam: "a".repeat(64), barem: "b".repeat(64) },
};

describe("olympiad barem chat adapter", () => {
  it("builds a payload with explanation-focused pedagogical instructions", () => {
    const payload = buildOlympiadBaremChatPayload(
      "messages",
      "example-model",
      exam,
      { examId: exam.id, subjectText: "Problema 1", baremText: "Soluția 1" },
      [{ role: "user", content: "Cum încep problema 1?" }],
    );

    expect("system" in payload ? payload.system : "").toContain(
      "Explica rationamentul gradual",
    );
    expect("system" in payload ? payload.system : "").toContain(
      "verificarea rezultatului fata de baremul oficial",
    );
  });

  it("limits GPT-OSS reasoning latency for olympiad explanations", () => {
    const payload = buildOlympiadBaremChatPayload(
      "chat-completions",
      "openai/gpt-oss-120b",
      exam,
      { examId: exam.id, subjectText: "Problema 1", baremText: "Soluția 1" },
      [{ role: "user", content: "Cum încep problema 1?" }],
    );

    expect(payload).toMatchObject({ reasoning_effort: "low" });
    expect(payload).not.toHaveProperty("reasoning");
  });
});
