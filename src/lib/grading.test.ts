import { describe, expect, it } from "vitest";
import {
  aiGradeJsonSchema,
  buildAiProviderGradePayload,
  buildChatCompletionsGradePayload,
  buildMessagesGradePayload,
  collectStreamingGradeResponse,
  extractJsonText,
  IncompleteGradeResponseError,
  isOficiuItem,
  supportsJsonSchemaStructuredOutput,
  parseGradeFromText,
  parseAiProviderGradeResponse,
  platformGradeContext,
  reconcileGradeResult,
  recomputeGradeWithOverrides,
} from "./grading";
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

const gradeJson = {
  totalScore: 9.5,
  rawPoints: 95,
  confidence: 0.9,
  breakdown: [
    {
      section: "Subiectul I",
      item: "1",
      maxPoints: 5,
      awardedPoints: 5,
      feedback: "Corect.",
      studentEvidence: "Poza 1: rezolvare vizibilă.",
      rubricEvidence: "Barem: 5 puncte.",
      confidence: 0.9,
    },
  ],
  unclearWorkWarnings: [],
  manualReviewNotes: [],
};

const platformExam: Exam = {
  ...exam,
  id: "olympiad:informatica:2026",
  category: "olympiad",
  title: "Olimpiada de Informatică 2026",
  platform: {
    provider: "kilonova",
    url: "https://kilonova.ro/contests/123",
  },
};

describe("grading adapter", () => {
  it("extracts fenced JSON", () => {
    expect(extractJsonText("```json\n{\"a\":1}\n```")).toBe("{\"a\":1}");
  });

  it("validates grade JSON", () => {
    expect(parseGradeFromText(JSON.stringify(gradeJson)).totalScore).toBe(9.5);
    expect(() => parseGradeFromText("{}")).toThrow();
  });

  it("rejects model scores outside the valid scale", () => {
    expect(() =>
      parseGradeFromText(
        JSON.stringify({ ...gradeJson, totalScore: 0, rawPoints: 0 }),
      ),
    ).toThrow();
  });

  it("rejects item scores above the rubric maximum", () => {
    expect(() =>
      parseGradeFromText(
        JSON.stringify({
          ...gradeJson,
          breakdown: [
            { ...gradeJson.breakdown[0], maxPoints: 5, awardedPoints: 6 },
          ],
        }),
      ),
    ).toThrow();
  });

  it("recalculates complete Bac totals from item scores", () => {
    const result = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          ...gradeJson,
          totalScore: 4,
          rawPoints: 40,
          breakdown: [
            {
              ...gradeJson.breakdown[0],
              maxPoints: 100,
              awardedPoints: 87.5,
              confidence: 0.9,
              studentEvidence: "Poza 1: calcule vizibile.",
              rubricEvidence: "Barem: 100 de puncte.",
            },
          ],
        }),
      ),
      exam,
    );

    expect(result).toMatchObject({
      rawPoints: 87.5,
      totalScore: 8.75,
      reviewRequired: true,
    });
    expect(result.reviewReasons).toContain(
      "Totalul declarat de model a fost corectat din punctajele pe itemi.",
    );
  });

  it("flags incomplete Bac breakdowns for manual review", () => {
    const result = reconcileGradeResult(parseGradeFromText(JSON.stringify(gradeJson)), exam);
    expect(result.reviewRequired).toBe(true);
    expect(result.reviewReasons).toEqual(
      expect.arrayContaining([expect.stringContaining("din 100 de puncte")]),
    );
  });

  it("accepts a complete, evidence-backed Bac breakdown", () => {
    const item = (
      section: string,
      itemLabel: string,
      maxPoints: number,
    ) => ({
      section,
      item: itemLabel,
      maxPoints,
      awardedPoints: maxPoints,
      feedback: "Corect.",
      confidence: 0.95,
      studentEvidence: "Poza 1: rezolvare vizibilă.",
      rubricEvidence: `Barem: ${maxPoints} puncte.`,
    });
    const result = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          ...gradeJson,
          totalScore: 10,
          rawPoints: 100,
          breakdown: [
            item("Subiectul I", "1", 30),
            item("Subiectul II", "1", 30),
            item("Subiectul III", "1.a", 15),
            item("Subiectul III", "1.b", 15),
            item("Oficiu", "10 puncte", 10),
          ],
        }),
      ),
      exam,
    );

    expect(result.reviewRequired).toBe(false);
    expect(result.reviewReasons).toEqual([]);
  });

  it("requires two complete thematic areas for Physics", () => {
    const physicsExam: Exam = { ...exam, subject: "fizica" };
    const item = (section: string, maxPoints: number) => ({
      section,
      item: "1",
      maxPoints,
      awardedPoints: maxPoints,
      feedback: "Corect.",
      confidence: 0.9,
      studentEvidence: "Poza 1: rezolvare vizibilă.",
      rubricEvidence: `Barem: ${maxPoints} puncte.`,
    });
    const complete = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          ...gradeJson,
          totalScore: 10,
          rawPoints: 100,
          breakdown: [
            item("A. Mecanică - Subiectul I", 15),
            item("A. Mecanică - Subiectul II", 15),
            item("A. Mecanică - Subiectul III", 15),
            item("D. Optică - Subiectul I", 15),
            item("D. Optică - Subiectul II", 15),
            item("D. Optică - Subiectul III", 15),
            item("Oficiu", 10),
          ],
        }),
      ),
      physicsExam,
    );

    expect(complete.reviewRequired).toBe(false);

    const missingArea = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          ...gradeJson,
          totalScore: 10,
          rawPoints: 100,
          breakdown: [
            item("A. Mecanică - Subiectul I", 15),
            item("A. Mecanică - Subiectul II", 15),
            item("A. Mecanică - Subiectul III", 60),
            item("Oficiu", 10),
          ],
        }),
      ),
      physicsExam,
    );

    expect(missingArea.reviewReasons).toContain(
      "La Fizică trebuie evaluate exact două arii tematice identificabile.",
    );
  });

  it("parses chat completions responses", () => {
    expect(
      parseAiProviderGradeResponse({
        choices: [{ message: { content: JSON.stringify(gradeJson) } }],
      }).rawPoints,
    ).toBe(95);
  });

  it("parses Anthropic-compatible message responses", () => {
    expect(
      parseAiProviderGradeResponse({
        content: [{ type: "text", text: JSON.stringify(gradeJson) }],
      }).rawPoints,
    ).toBe(95);
  });

  it("reports output stopped by the provider token limit", () => {
    expect(() =>
      parseAiProviderGradeResponse({
        stop_reason: "max_tokens",
        content: [{ type: "text", text: '{"totalScore": 8' }],
      }),
    ).toThrow(IncompleteGradeResponseError);
    expect(() =>
      parseAiProviderGradeResponse({
        choices: [
          {
            finish_reason: "length",
            message: { content: '{"totalScore": 8' },
          },
        ],
      }),
    ).toThrow(IncompleteGradeResponseError);
  });

  it("builds an OpenAI-compatible multimodal chat payload", () => {
    const payload = buildChatCompletionsGradePayload(
      "generic-chat-model",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [{ mimeType: "image/jpeg", base64: "abc" }],
    );

    expect(payload.model).toBe("generic-chat-model");
    expect(payload.max_tokens).toBe(8192);
    expect(payload.messages[1].content[1]).toEqual({
      type: "text",
      text: "Poza 1 din lucrarea elevului:",
    });
    expect(payload.messages[1].content[2]).toMatchObject({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,abc" },
    });
    expect(payload.response_format).toEqual({ type: "json_object" });
  });

  it("grades platform screenshots without subject or barem context", () => {
    expect(platformGradeContext(platformExam)).toEqual({
      examId: platformExam.id,
      subjectText: "",
      baremText: "",
    });
    expect(platformGradeContext(exam)).toBeUndefined();

    const payload = buildChatCompletionsGradePayload(
      "generic-chat-model",
      platformExam,
      { examId: platformExam.id, subjectText: "", baremText: "" },
      [{ mimeType: "image/png", base64: "screenshot" }],
    );
    const promptPart = payload.messages[1].content[0];
    if (typeof promptPart === "string" || !("text" in promptPart)) {
      throw new Error("Prompt text missing.");
    }

    expect(promptPart.text).toContain("Platformă așteptată: Kilonova");
    expect(promptPart.text).toContain("Nu corecta rezolvarea și nu folosi un barem");
    expect(promptPart.text).not.toContain("Text subiect:");

    const result = reconcileGradeResult(
      parseGradeFromText(JSON.stringify({
        totalScore: 8.75,
        rawPoints: 87.5,
        confidence: 0.95,
        breakdown: [{
          section: "Rezultat platformă",
          item: "Kilonova",
          maxPoints: 100,
          awardedPoints: 87.5,
          feedback: "Punctaj confirmat.",
          studentEvidence: "Poza 1: 350 din 400 de puncte pe Kilonova.",
          rubricEvidence: "350 / 400 × 100 = 87,5.",
          confidence: 0.95,
        }],
        unclearWorkWarnings: [],
        manualReviewNotes: [],
      })),
      platformExam,
    );

    expect(result).toMatchObject({
      totalScore: 8.75,
      rawPoints: 87.5,
      reviewRequired: false,
    });
  });

  it("builds an Anthropic-compatible multimodal messages payload", () => {
    const payload = buildMessagesGradePayload(
      "qwen3.7-plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [{ mimeType: "image/jpeg", base64: "abc" }],
    );

    expect(payload.model).toBe("qwen3.7-plus");
    expect(payload.thinking).toEqual({ type: "disabled" });
    expect(payload.messages[0].content[1]).toEqual({
      type: "text",
      text: "Poza 1 din lucrarea elevului:",
    });
    expect(payload.messages[0].content[2]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "abc" },
    });
  });

  it("chooses the payload shape from the endpoint kind", () => {
    expect(
      buildAiProviderGradePayload(
        "messages",
        "qwen3.7-plus",
        exam,
        { examId: exam.id, subjectText: "subiect", baremText: "barem" },
        [],
      ),
    ).toHaveProperty("system");
  });

  it("keeps the complete official context needed by long exams", () => {
    const subjectTail = "MARCAJ_SUBIECT_FINAL";
    const baremTail = "MARCAJ_BAREM_FINAL";
    const payload = buildChatCompletionsGradePayload(
      "qwen3.7-plus",
      exam,
      {
        examId: exam.id,
        subjectText: `${"s".repeat(25_000)}${subjectTail}`,
        baremText: `${"b".repeat(35_000)}${baremTail}`,
      },
      [],
    );
    const promptPart = payload.messages[1].content[0];
    if (typeof promptPart === "string" || !("text" in promptPart)) {
      throw new Error("Prompt text missing.");
    }
    const prompt = promptPart.text;

    expect(prompt).toContain(subjectTail);
    expect(prompt).toContain(baremTail);
  });

  it("adds subject-specific Physics scoring rules", () => {
    const payload = buildChatCompletionsGradePayload(
      "qwen3.7-plus",
      { ...exam, subject: "fizica" },
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [],
    );
    const promptPart = payload.messages[1].content[0];
    if (typeof promptPart === "string" || !("text" in promptPart)) {
      throw new Error("Prompt text missing.");
    }
    const prompt = promptPart.text;

    expect(prompt).toContain("primele doua arii tematice");
    expect(prompt).toContain("A. Mecanica - Subiectul I");
    expect(prompt).toContain("un singur rand separat pentru punctele din oficiu");
  });

  it("detects models that support JSON Schema structured output", () => {
    expect(supportsJsonSchemaStructuredOutput("Qwen/Qwen3.7-Plus")).toBe(true);
    expect(supportsJsonSchemaStructuredOutput("Qwen/Qwen3.7-Plus ")).toBe(true);
    expect(supportsJsonSchemaStructuredOutput("qwen/qwen-3.7-plus")).toBe(true);
    expect(supportsJsonSchemaStructuredOutput("generic-model")).toBe(false);
    expect(supportsJsonSchemaStructuredOutput("gpt-4")).toBe(false);
  });

  it("produces structured output with reasoning disabled for supported models", () => {
    const payload = buildChatCompletionsGradePayload(
      "Qwen/Qwen3.7-Plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [{ mimeType: "image/jpeg", base64: "abc" }],
    );

    expect(payload.model).toBe("Qwen/Qwen3.7-Plus");
    expect(payload.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "iabacu_bac_grading_result",
        schema: aiGradeJsonSchema,
      },
    });
    expect(payload.reasoning).toEqual({ enabled: false });
  });

  it("emits image_url data URLs without detail for structured output models", () => {
    const payload = buildChatCompletionsGradePayload(
      "Qwen/Qwen3.7-Plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [
        { mimeType: "image/jpeg", base64: "abc" },
        { mimeType: "image/png", base64: "def" },
      ],
    );

    const userContent = payload.messages[1].content;
    const imageBlocks = userContent.filter(
      (block: Record<string, unknown>) =>
        typeof block === "object" && block !== null && "type" in block && block.type === "image_url",
    );

    expect(imageBlocks).toHaveLength(2);
    expect(imageBlocks[0]).toMatchObject({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,abc" },
    });
    expect(imageBlocks[0].image_url).not.toHaveProperty("detail");
    expect(imageBlocks[1]).toMatchObject({
      type: "image_url",
      image_url: { url: "data:image/png;base64,def" },
    });
    expect(imageBlocks[1].image_url).not.toHaveProperty("detail");
  });

  it("preserves Poza labels and uploaded order for all images", () => {
    const payload = buildChatCompletionsGradePayload(
      "Qwen/Qwen3.7-Plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [
        { mimeType: "image/jpeg", base64: "first" },
        { mimeType: "image/jpeg", base64: "second" },
        { mimeType: "image/jpeg", base64: "third" },
      ],
    );

    const userContent = payload.messages[1].content;
    const textBlocks = userContent.filter(
      (block: Record<string, unknown>) =>
        typeof block === "object" && block !== null && "type" in block && block.type === "text",
    );

    const labels = textBlocks
      .map((block: Record<string, unknown>) => ("text" in block ? block.text : ""))
      .filter((text: string) => text.startsWith("Poza "));

    expect(labels).toEqual([
      "Poza 1 din lucrarea elevului:",
      "Poza 2 din lucrarea elevului:",
      "Poza 3 din lucrarea elevului:",
    ]);
  });

  it("includes the JSON Schema derived from the Zod model-output schema", () => {
    const payload = buildChatCompletionsGradePayload(
      "Qwen/Qwen3.7-Plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [],
    );

    const responseFormat = payload.response_format as {
      type: string;
      json_schema?: { name: string; schema: unknown };
    };
    expect(responseFormat.type).toBe("json_schema");
    expect(responseFormat.json_schema?.name).toBe("iabacu_bac_grading_result");
    expect(responseFormat.json_schema?.schema).toEqual(aiGradeJsonSchema);

    const promptPart = payload.messages[1].content[0];
    if (typeof promptPart === "string" || !("text" in promptPart)) {
      throw new Error("Prompt text missing.");
    }
    expect(promptPart.text).toContain(JSON.stringify(aiGradeJsonSchema));
  });

  it("keeps complete official exam and barem context for structured output", () => {
    const subjectTail = "MARCAJ_SUBIECT_FINAL";
    const baremTail = "MARCAJ_BAREM_FINAL";
    const payload = buildChatCompletionsGradePayload(
      "Qwen/Qwen3.7-Plus",
      exam,
      {
        examId: exam.id,
        subjectText: `${"s".repeat(25_000)}${subjectTail}`,
        baremText: `${"b".repeat(35_000)}${baremTail}`,
      },
      [],
    );
    const promptPart = payload.messages[1].content[0];
    if (typeof promptPart === "string" || !("text" in promptPart)) {
      throw new Error("Prompt text missing.");
    }
    const prompt = promptPart.text;

    expect(prompt).toContain(subjectTail);
    expect(prompt).toContain(baremTail);
  });

  it("keeps Physics-specific rules for structured output", () => {
    const payload = buildChatCompletionsGradePayload(
      "Qwen/Qwen3.7-Plus",
      { ...exam, subject: "fizica" },
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [],
    );
    const promptPart = payload.messages[1].content[0];
    if (typeof promptPart === "string" || !("text" in promptPart)) {
      throw new Error("Prompt text missing.");
    }
    const prompt = promptPart.text;

    expect(prompt).toContain("primele doua arii tematice");
    expect(prompt).toContain("A. Mecanica - Subiectul I");
  });

  it("keeps office-points rules for structured output", () => {
    const payload = buildChatCompletionsGradePayload(
      "Qwen/Qwen3.7-Plus",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [],
    );
    const promptPart = payload.messages[1].content[0];
    if (typeof promptPart === "string" || !("text" in promptPart)) {
      throw new Error("Prompt text missing.");
    }
    const prompt = promptPart.text;

    expect(prompt).toContain("un singur rand separat pentru punctele din oficiu");
    expect(prompt).toContain("Oficiu");
  });

  it("parses a streaming chat completions response", () => {
    const result = parseAiProviderGradeResponse({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(gradeJson) },
        },
      ],
    });
    expect(result.rawPoints).toBe(95);
    expect(result.totalScore).toBe(9.5);
  });

  it("detects finish_reason length as incomplete", () => {
    expect(() =>
      parseAiProviderGradeResponse({
        choices: [
          {
            finish_reason: "length",
            message: { content: '{"totalScore": 8' },
          },
        ],
      }),
    ).toThrow(IncompleteGradeResponseError);
  });

  it("rejects schema-invalid output from the AI", () => {
    expect(() =>
      parseGradeFromText(
        JSON.stringify({
          totalScore: 9.5,
          rawPoints: 95,
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
        }),
      ),
    ).toThrow();
  });

  it("reconciles model arithmetic deterministically", () => {
    const result = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          totalScore: 4,
          rawPoints: 40,
          confidence: 0.9,
          breakdown: [
            {
              section: "Subiectul I",
              item: "1",
              maxPoints: 30,
              awardedPoints: 30,
              feedback: "Corect.",
              studentEvidence: "Poza 1: rezolvare vizibilă.",
              rubricEvidence: "Barem: 30 puncte.",
              confidence: 0.95,
            },
            {
              section: "Subiectul II",
              item: "1",
              maxPoints: 30,
              awardedPoints: 30,
              feedback: "Corect.",
              studentEvidence: "Poza 2: rezolvare vizibilă.",
              rubricEvidence: "Barem: 30 puncte.",
              confidence: 0.95,
            },
            {
              section: "Subiectul III",
              item: "1",
              maxPoints: 30,
              awardedPoints: 27.5,
              feedback: "Partial.",
              studentEvidence: "Poza 3: rezolvare partiala.",
              rubricEvidence: "Barem: 30 puncte.",
              confidence: 0.85,
            },
            {
              section: "Oficiu",
              item: "10 puncte",
              maxPoints: 10,
              awardedPoints: 10,
              feedback: "Oficiu.",
              studentEvidence: "Punctaj acordat automat conform baremului.",
              rubricEvidence: "Barem: 10 puncte.",
              confidence: 1,
            },
          ],
          unclearWorkWarnings: [],
          manualReviewNotes: [],
        }),
      ),
      exam,
    );

    expect(result.rawPoints).toBe(97.5);
    expect(result.totalScore).toBe(9.75);
    expect(result.reviewRequired).toBe(true);
    expect(result.reviewReasons).toContain(
      "Totalul declarat de model a fost corectat din punctajele pe itemi.",
    );
  });

  it("does not add structured-output parameters for unsupported models", () => {
    const payload = buildChatCompletionsGradePayload(
      "generic-chat-model",
      exam,
      { examId: exam.id, subjectText: "subiect", baremText: "barem" },
      [{ mimeType: "image/jpeg", base64: "abc" }],
    );

    expect(payload.response_format).toEqual({ type: "json_object" });
    expect(payload).not.toHaveProperty("reasoning");
  });

  it("collects a streaming response into a parseable shape", async () => {
    const sse = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"totalScore":' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '8.75,"rawPoints":87.5,' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '"confidence":0.82,"breakdown":[{"section":"Subiectul I","item":"1","maxPoints":100,"awardedPoints":87.5,"feedback":"Aproape.","studentEvidence":"Poza 1: vizibil.","rubricEvidence":"Barem: 87.5p","confidence":0.9}],"unclearWorkWarnings":[],"manualReviewNotes":[]}' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");

    const response = new Response(sse, {
      headers: { "content-type": "text/event-stream" },
    });

    const collected = await collectStreamingGradeResponse(response);
    const result = parseAiProviderGradeResponse(collected, exam);

    expect(result.totalScore).toBe(8.75);
    expect(result.rawPoints).toBe(87.5);
  });

  it("detects truncated streaming output", async () => {
    const sse = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"totalScore":8' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ finish_reason: "length" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");

    const response = new Response(sse, {
      headers: { "content-type": "text/event-stream" },
    });

    const collected = await collectStreamingGradeResponse(response);
    expect(() => parseAiProviderGradeResponse(collected)).toThrow(
      IncompleteGradeResponseError,
    );
  });
});

describe("recomputeGradeWithOverrides", () => {
  function buildBaseline(maxBySubject: Record<string, number>) {
    const breakdown = [
      ...Object.entries(maxBySubject).map(([section, maxPoints]) => ({
        section,
        item: "1",
        maxPoints,
        awardedPoints: maxPoints,
        feedback: "Corect.",
        confidence: 0.95,
        studentEvidence: "Poza 1: vizibil.",
        rubricEvidence: `Barem: ${maxPoints} puncte.`,
      })),
      {
        section: "Oficiu",
        item: "10 puncte",
        maxPoints: 10,
        awardedPoints: 10,
        feedback: "Punctaj din oficiu.",
        studentEvidence: "Punctaj acordat automat conform baremului.",
        rubricEvidence: "Barem: 10 puncte din oficiu.",
        confidence: 1,
      },
    ];
    return reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          ...gradeJson,
          totalScore: 10,
          rawPoints: 100,
          breakdown,
        }),
      ),
      exam,
    );
  }

  it("returns the grade unchanged when no overrides are supplied", () => {
    const baseline = buildBaseline({
      "Subiectul I": 30,
      "Subiectul II": 30,
      "Subiectul III": 30,
    });
    expect(recomputeGradeWithOverrides(baseline, {}, false)).toBe(baseline);
  });

  it("clamps an override to the item maximum and recomputes the Bac note", () => {
    const baseline = buildBaseline({
      "Subiectul I": 30,
      "Subiectul II": 30,
      "Subiectul III": 30,
    });
    const reduced = recomputeGradeWithOverrides(baseline, { 0: 18 }, false);
    expect(reduced.breakdown[0].awardedPoints).toBe(18);
    expect(reduced.rawPoints).toBe(88);
    expect(reduced.totalScore).toBe(8.8);
    expect(reduced.reviewRequired).toBe(false);
  });

  it("clamps overrides above the item maximum and below zero", () => {
    const baseline = buildBaseline({
      "Subiectul I": 30,
      "Subiectul II": 30,
      "Subiectul III": 30,
    });
    const tooHigh = recomputeGradeWithOverrides(baseline, { 1: 999 }, false);
    expect(tooHigh.breakdown[1].awardedPoints).toBe(30);
    const negative = recomputeGradeWithOverrides(baseline, { 2: -5 }, false);
    expect(negative.breakdown[2].awardedPoints).toBe(0);
  });

  it("preserves the olympiad proportional scoring when overridden", () => {
    const olympiadExam: Exam = { ...exam, id: "olimpiada-mate-info-2026" };
    const baseline = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          ...gradeJson,
          totalScore: 10,
          rawPoints: 100,
          breakdown: [
            {
              section: "Problema 1",
              item: "a",
              maxPoints: 50,
              awardedPoints: 50,
              feedback: "Corect.",
              confidence: 0.9,
              studentEvidence: "Poza 1: rezolvare vizibilă.",
              rubricEvidence: "Barem: 50 puncte.",
            },
            {
              section: "Problema 2",
              item: "a",
              maxPoints: 50,
              awardedPoints: 25,
              feedback: "Parțial.",
              confidence: 0.8,
              studentEvidence: "Poza 2: doar jumătate.",
              rubricEvidence: "Barem: 50 puncte.",
            },
          ],
        }),
      ),
      olympiadExam,
    );
    const reduced = recomputeGradeWithOverrides(baseline, { 0: 30 }, true);
    expect(reduced.breakdown[0].awardedPoints).toBe(30);
    expect(reduced.rawPoints).toBe(55);
    expect(reduced.totalScore).toBe(5.5);
  });

  it("scales olympiad totals only when a positive maximum remains", () => {
    const olympiadExam: Exam = { ...exam, id: "olimpiada-mate-info-2026" };
    const baseline = reconcileGradeResult(
      parseGradeFromText(
        JSON.stringify({
          ...gradeJson,
          totalScore: 10,
          rawPoints: 100,
          breakdown: [
            {
              section: "Problema 1",
              item: "a",
              maxPoints: 50,
              awardedPoints: 50,
              feedback: "Corect.",
              confidence: 0.9,
              studentEvidence: "Poza 1: rezolvare vizibilă.",
              rubricEvidence: "Barem: 50 puncte.",
            },
          ],
        }),
      ),
      olympiadExam,
    );
    const collapsed = recomputeGradeWithOverrides(
      { ...baseline, breakdown: [{ ...baseline.breakdown[0], maxPoints: 0 }] },
      { 0: 0 },
      true,
    );
    expect(collapsed.totalScore).toBe(baseline.totalScore);
    expect(collapsed.rawPoints).toBe(baseline.rawPoints);
  });
});

describe("isOficiuItem", () => {
  it("detects the office row across label variants and diacritics", () => {
    const make = (section: string, item: string) =>
      ({ section, item, maxPoints: 10, awardedPoints: 10, feedback: "x" });
    expect(isOficiuItem(make("Oficiu", "10 puncte"))).toBe(true);
    expect(isOficiuItem(make("oficiu", "Oficiu"))).toBe(true);
    expect(isOficiuItem(make("Puncte din oficiu", "10"))).toBe(true);
    expect(isOficiuItem(make("Subiectul III", "1.a"))).toBe(false);
  });
});
