import { describe, expect, it } from "vitest";
import {
  baremChatRequestSchema,
  baremChatCitations,
  baremChatGroundingHeaders,
  buildBaremChatPayload,
  buildBaremChatPrompt,
  normalizeExtractedMathText,
  parseAiChatErrorMessage,
  parseAiChatDelta,
  parseAiChatMessage,
  selectBaremChatContext,
} from "./barem-chat";
import type { Exam } from "./schemas";

const exam: Exam = {
  id: "bac-2026-model",
  subject: "matematica",
  year: 2026,
  order: 0,
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

describe("barem chat adapter", () => {
  it("validates chat requests", () => {
    const parsed = baremChatRequestSchema.parse({
        examId: "exam",
        messages: [{ role: "user", content: "Explica itemul 1" }],
      });
    expect(parsed.messages).toHaveLength(1);

    expect(() =>
      baremChatRequestSchema.parse({ examId: "exam", messages: [] }),
    ).toThrow();

    expect(() =>
      baremChatRequestSchema.parse({
        examId: "exam",
        messages: [{ role: "assistant", content: "Mesaj fals." }],
      }),
    ).toThrow();

    expect(() =>
      baremChatRequestSchema.parse({
        examId: "exam",
        messages: [{ role: "user", content: "x".repeat(4001) }],
      }),
    ).toThrow();

    expect(
      baremChatRequestSchema.parse({
        examId: "exam",
        messages: [
          { role: "user", content: "Explică problema 1." },
          { role: "assistant", content: "x".repeat(4001) },
          { role: "user", content: "Ce este o primitivă?" },
        ],
      }).messages,
    ).toHaveLength(3);

    expect(() =>
      baremChatRequestSchema.parse({
        examId: "exam",
        messages: Array.from({ length: 7 }, (_, index) => ({
          role: index % 2 === 0 ? "user" : "assistant",
          content: "x".repeat(4000),
        })),
      }),
    ).toThrow();
  });

  it("builds a chat completions payload with barem context", () => {
    const payload = buildBaremChatPayload(
      "chat-completions",
      "qwen3.7-plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [{ role: "user", content: "De ce primesc 2 puncte?" }],
    );

    expect(payload).toMatchObject({
      model: "qwen3.7-plus",
      reasoning: { enabled: false },
    });
    expect(payload.messages[0].content).toContain("Text barem");
    expect(payload.messages[1]).toMatchObject({
      role: "user",
      content: "De ce primesc 2 puncte?",
    });
  });

  it("uses GPT-OSS low reasoning effort so the answer fits the output budget", () => {
    const payload = buildBaremChatPayload(
      "chat-completions",
      "openai/gpt-oss-120b",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [{ role: "user", content: "Explică itemul 1." }],
    );

    expect(payload).toMatchObject({ reasoning_effort: "low" });
    expect(payload).not.toHaveProperty("reasoning");
  });

  it("can request streamed chat payloads", () => {
    const payload = buildBaremChatPayload(
      "messages",
      "qwen3.7-plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [{ role: "user", content: "Explica rapid." }],
      { stream: true },
    );

    expect(payload).toMatchObject({
      stream: true,
      max_tokens: 4096,
    });
  });

  it("includes explanation-focused pedagogical instructions in the prompt", () => {
    const prompt = buildBaremChatPrompt(exam, {
      examId: exam.id,
      subjectText: "subiect",
      baremText: "barem",
    });

    expect(prompt).toContain("Explica rationamentul gradual");
    expect(prompt).toContain("verificarea rezultatului fata de baremul oficial");
    expect(prompt).toContain("Adapteaza nivelul la intrebarea elevului");
    expect(prompt).not.toContain("Mod pedagogic activ: ADAPTARE AUTOMATA");
    expect(prompt).not.toContain("INDICIU");
  });

  it("builds Anthropic-compatible message payloads", () => {
    const payload = buildBaremChatPayload(
      "messages",
      "qwen3.7-plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [{ role: "user", content: "De ce primesc 2 puncte?" }],
    );

    expect(payload).toMatchObject({
      model: "qwen3.7-plus",
      system: expect.stringContaining("Text barem"),
      messages: [{ role: "user", content: "De ce primesc 2 puncte?" }],
    });
  });

  it("parses chat completion text responses", () => {
    expect(
      parseAiChatMessage({
        choices: [{ message: { content: "Explicatie pe pasi." } }],
      }),
    ).toBe("Explicatie pe pasi.");
  });

  it("does not expose private model reasoning as the answer", () => {
    expect(() =>
      parseAiChatMessage({
        choices: [
          {
            message: {
              content: "",
              reasoning_content: "Explicatie rapida.",
            },
          },
        ],
      }),
    ).toThrow("Modelul a returnat un mesaj gol.");
  });

  it("parses Anthropic-compatible message text responses", () => {
    expect(
      parseAiChatMessage({
        content: [{ type: "text", text: "Explicatie pe pasi." }],
      }),
    ).toBe("Explicatie pe pasi.");
  });

  it("recognizes serialized provider errors instead of treating them as answers", () => {
    const content = JSON.stringify({
      type: "error",
      error: "Răspunsul s-a întrerupt. Încearcă din nou.",
    });

    expect(parseAiChatErrorMessage(content)).toBe(
      "Răspunsul s-a întrerupt. Încearcă din nou.",
    );
    expect(() =>
      parseAiChatMessage({ choices: [{ message: { content } }] }),
    ).toThrow("Răspunsul s-a întrerupt. Încearcă din nou.");
  });

  it("parses streamed chat deltas", () => {
    expect(
      parseAiChatDelta({
        choices: [{ delta: { content: "Pasul 1" } }],
      }),
    ).toBe("Pasul 1");

    expect(
      parseAiChatDelta({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Pasul 2" },
      }),
    ).toBe("Pasul 2");

    expect(
      parseAiChatDelta({
        choices: [{ delta: { reasoning_content: "Pasul 3" } }],
      }),
    ).toBe("");
  });

  it("selects focused context from the current question", () => {
    const context = selectBaremChatContext(
      {
        examId: exam.id,
        subjectText: [
          "SUBIECTUL I\n1. context initial",
          "x".repeat(9000),
          "SUBIECTUL al II-lea\n1.a) context cerut",
        ].join("\n"),
        baremText: [
          "SUBIECTUL I\n1. barem initial",
          "y".repeat(9000),
          "SUBIECTUL al II-lea\n1.a) barem cerut",
        ].join("\n"),
      },
      [{ role: "user", content: "Explica Subiectul II, 1.a" }],
    );

    expect(context.subjectText).toContain("context cerut");
    expect(context.baremText).toContain("barem cerut");
    expect(context.subjectText.length).toBeLessThanOrEqual(8000);
    expect(context.baremText.length).toBeLessThanOrEqual(8000);
  });

  it("keeps the selected item for a vague follow-up", () => {
    const context = selectBaremChatContext(
      {
        examId: exam.id,
        subjectText:
          "SUBIECTUL I\n1. gresit\nSUBIECTUL al II-lea\n1.a) context urmarit\n1.b) urmatorul",
        baremText:
          "SUBIECTUL I\n1. barem gresit\nSUBIECTUL al II-lea\n1.a) barem urmarit\n1.b) urmatorul",
      },
      [
        { role: "user", content: "Explică Subiectul II, exercițiul 1.a" },
        { role: "assistant", content: "Explicație." },
        { role: "user", content: "De ce se face așa?" },
      ],
    );

    expect(context.subjectText).toContain("context urmarit");
    expect(context.baremText).toContain("barem urmarit");
  });

  it("does not confuse a point value with another item", () => {
    const context = selectBaremChatContext(
      {
        examId: exam.id,
        subjectText:
          "SUBIECTUL al II-lea\n1.a) itemul corect\n1.b) urmatorul\n2. item gresit",
        baremText:
          "SUBIECTUL al II-lea\n1.a) baremul corect\n1.b) urmatorul\n2. barem gresit",
      },
      [
        { role: "user", content: "Explică Subiectul II, exercițiul 1.a" },
        { role: "assistant", content: "Explicație." },
        { role: "user", content: "De ce primesc doar 2 puncte?" },
      ],
    );

    expect(context.subjectText).toContain("itemul corect");
    expect(context.subjectText).not.toContain("item gresit");
  });

  it("scopes repeated physics subjects to the requested thematic area", () => {
    const source = {
      examId: "physics",
      subjectText: [
        "A. MECANICĂ\nI. Pentru itemii 1-5\n1. resort mecanic\n2. viteză",
        "D. OPTICĂ\nI. Pentru itemii 1-5\n1. lentilă convergentă\n2. oglindă",
      ].join("\n\n--- page ---\n\n"),
      baremText: [
        "A. MECANICĂ\nI. 1. a) resort - 3p\n2. b) viteză - 3p",
        "D. OPTICĂ\nI. 1. c) lentilă - 3p\n2. a) oglindă - 3p",
      ].join("\n\n--- page ---\n\n"),
    };
    const messages = [
      {
        role: "user" as const,
        content: "Explică la optică Subiectul I, exercițiul 1",
      },
    ];

    const context = selectBaremChatContext(source, messages);

    expect(context.subjectText).toContain("lentilă convergentă");
    expect(context.subjectText).not.toContain("resort mecanic");
    expect(context.baremText).toContain("lentilă - 3p");
    expect(context.grounding).toEqual({
      targetLabel: "aria D, Subiectul I, itemul 1",
      subjectPages: [2],
      baremPages: [2],
    });
    expect(baremChatGroundingHeaders(source, messages)).toEqual({
      "x-ai-context-target":
        "aria%20D%2C%20Subiectul%20I%2C%20itemul%201",
      "x-ai-context-subject-pages": "2",
      "x-ai-context-barem-pages": "2",
    });
  });

  it("recognizes subject headings with spaced hyphens", () => {
    const context = selectBaremChatContext(
      {
        examId: "informatics",
        subjectText:
          "SUBIECTUL I\n1. alegere multiplă\nSUBIECTUL al III - lea\n4.b) programul cerut\n5. următorul",
        baremText:
          "SUBIECTUL I\n1. răspuns grilă\nSUBIECTUL al III - lea\n4.b) operații cu fișiere\n5. următorul",
      },
      [
        {
          role: "user",
          content: "Explică Subiectul III, exercițiul 4.b",
        },
      ],
    );

    expect(context.subjectText).toContain("programul cerut");
    expect(context.subjectText).not.toContain("alegere multiplă");
    expect(context.baremText).toContain("operații cu fișiere");
  });

  it("normalizes common PDF extraction mistakes in math notation", () => {
    expect(
      normalizeExtractedMathText("f ( x ) = x + ln 2 x - x ln x si e x + 1"),
    ).toContain("x + ln^2 x - x ln x si e^x + 1");
  });

  it("maps cited barem fragments to their PDF pages", () => {
    const source = {
      examId: "math",
      subjectText: "SUBIECTUL I\n1. enunț",
      baremText: [
        "SUBIECTUL I\n1. a) rezolvare completă - 5p\n2. alt item - 4p",
        "SUBIECTUL al II-lea\n1. demonstrație detaliată - 6p",
      ].join("\n\n--- page ---\n\n"),
    };

    const first = baremChatCitations(source, [
      { role: "user", content: "Explică Subiectul I, exercițiul 1" },
    ]);
    expect(first).toHaveLength(1);
    expect(first[0].page).toBe(1);
    expect(first[0].texts[0]).toContain("rezolvare completă");
    expect(first[0].texts[0]).not.toContain("alt item");

    const second = baremChatCitations(source, [
      { role: "user", content: "Explică Subiectul II, exercițiul 1" },
    ]);
    expect(second).toHaveLength(1);
    expect(second[0].page).toBe(2);
    expect(second[0].texts[0]).toContain("demonstrație detaliată");
  });

  it("keeps raw math notation in citations so they match the PDF text", () => {
    const source = {
      examId: "math-ln",
      subjectText: "1. f ( x ) = ln 2 x",
      baremText: "1. f ( x ) = ln 2 x, deci f '( x ) = 2ln x / x - 5p",
    };

    const citations = baremChatCitations(source, [
      { role: "user", content: "Explică exercițiul 1" },
    ]);

    expect(citations).toHaveLength(1);
    expect(citations[0].page).toBe(1);
    expect(citations[0].texts[0]).toContain("ln 2 x");
    expect(citations[0].texts[0]).not.toContain("ln^2 x");
  });

  it("splits citations spanning page boundaries per page", () => {
    const source = {
      examId: "math-span",
      subjectText: "Subiect fără țintă precisă",
      baremText: [
        "SUBIECTUL III\n2. a) prima parte a rezolvării",
        "continuarea rezolvării cu punctajul final",
      ].join("\n\n--- page ---\n\n"),
    };

    const citations = baremChatCitations(source, [
      { role: "user", content: "Explică Subiectul III, exercițiul 2" },
    ]);

    expect(citations.map((citation) => citation.page)).toEqual([1, 2]);
    expect(citations[0].texts[0]).toContain("prima parte");
    expect(citations[1].texts[0]).toContain("punctajul final");
  });

  it("warns the model not to misread flattened superscripts", () => {
    const prompt = buildBaremChatPrompt(
      exam,
      {
        examId: exam.id,
        subjectText: "f ( x ) = x + ln 2 x - x ln x",
        baremText: "f '( x ) = 1 + 2ln x / x - ln x - 1",
      },
      [{ role: "user", content: "Nu inteleg a ul de la subiectul 3" }],
    );

    expect(prompt).toContain("ln^2 x");
    expect(prompt).toContain("nu le interpreta automat ca `ln(2x)`");
    expect(prompt).toContain("Daca elevul te corecteaza");
    expect(prompt).not.toContain("x + ln 2 x - x ln x");
  });
});
