// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exams } from "@/lib/exams";

vi.mock("@/lib/ai-usage", () => ({
  claimAiUsage: vi.fn(async () => ({
    unlimited: false,
    used: 1,
    remaining: 2,
    limit: 3,
  })),
  releaseAiUsage: vi.fn(async () => undefined),
  aiUsageHeaders: vi.fn(() => ({
    "x-ai-limit": "3",
    "x-ai-remaining": "2",
  })),
  aiUsageErrorResponse: vi.fn(() => null),
}));

import { POST } from "./route";
import { releaseAiUsage } from "@/lib/ai-usage";

const gradeJson = {
  totalScore: 8.75,
  rawPoints: 87.5,
  confidence: 0.82,
  breakdown: [
    {
      section: "Subiectul I",
      item: "1",
      maxPoints: 100,
      awardedPoints: 87.5,
      feedback: "Aproape corect.",
      confidence: 0.9,
      studentEvidence: "Poza 1: răspunsul este vizibil.",
      rubricEvidence: "Barem: se acordă 87,5 puncte.",
    },
  ],
  unclearWorkWarnings: [],
  manualReviewNotes: [],
};

function setValidEnv() {
  vi.stubEnv("AI_PROVIDER_API_KEY", "test-key");
  vi.stubEnv("AI_PROVIDER_API_URL", "https://api.example.test/v1/messages");
  vi.stubEnv("AI_PROVIDER_MODEL", "example-grade-model");
}

function gradeRequest(examId = exams[0]?.id, file?: File) {
  const formData = new FormData();
  formData.append("examId", examId ?? "missing");
  formData.append(
    "work",
    file ??
      new File([new Uint8Array([1, 2, 3])], "work.jpg", {
        type: "image/jpeg",
      }),
  );
  return new Request("http://localhost/api/grade", {
    method: "POST",
    body: formData,
  });
}

describe.skipIf(exams.length === 0)("grade API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setValidEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns a validated grade for a mocked AI provider response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          content: [{ type: "text", text: JSON.stringify(gradeJson) }],
        }),
      ),
    );

    const response = await POST(gradeRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        totalScore: 8.75,
        model: "example-grade-model",
        pipelineVersion: "2026-07-17.1",
      },
    });
    expect(response.headers.get("x-ai-remaining")).toBe("2");
    expect(response.headers.get("x-ai-pipeline-version")).toBe(
      "2026-07-17.1",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/v1/messages",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
      }),
    );
  });

  it("rejects malformed model JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ content: [{ type: "text", text: "{}" }] }),
      ),
    );

    const response = await POST(gradeRequest());
    expect(response.status).toBe(500);
    expect(releaseAiUsage).toHaveBeenCalledWith("corrector");
  });

  it("explains truncated grading output and restores quota", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          stop_reason: "max_tokens",
          content: [{ type: "text", text: '{"totalScore": 8' }],
        }),
      ),
    );

    const response = await POST(gradeRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error:
        "Corectarea AI s-a oprit înainte să acopere toată lucrarea. Încearcă din nou; această încercare nu consumă din limita zilnică.",
    });
    expect(releaseAiUsage).toHaveBeenCalledWith("corrector");
  });

  it("returns a safe error and restores quota when the provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("internal provider details", { status: 503 }),
      ),
    );

    const response = await POST(gradeRequest());
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Serviciul AI nu a putut finaliza corectarea. Încearcă din nou.",
    });
    expect(releaseAiUsage).toHaveBeenCalledWith("corrector");
  });

  it("restores quota when grading is cancelled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("cancelled", "AbortError");
      }),
    );

    const response = await POST(gradeRequest());

    expect(response.status).toBe(408);
    await expect(response.json()).resolves.toEqual({
      error: "Cererea AI a fost oprită.",
    });
    expect(releaseAiUsage).toHaveBeenCalledWith("corrector");
  });

  it("fails fast when env is missing", async () => {
    vi.stubEnv("AI_PROVIDER_API_URL", "");
    const response = await POST(gradeRequest());
    expect(response.status).toBe(500);
  });

  it("rejects an unsupported file type", async () => {
    const response = await POST(
      gradeRequest(
        exams[0].id,
        new File(["text"], "work.txt", { type: "text/plain" }),
      ),
    );
    expect(response.status).toBe(415);
  });

  it("rejects oversized uploads", async () => {
    const response = await POST(
      gradeRequest(
        exams[0].id,
        new File([new Uint8Array(8 * 1024 * 1024)], "work.jpg", {
          type: "image/jpeg",
        }),
      ),
    );
    expect(response.status).toBe(413);
  });

  it("rejects an unknown exam", async () => {
    const response = await POST(gradeRequest("missing-exam"));
    expect(response.status).toBe(404);
  });

  it("sends a structured-output request and returns the frontend contract", async () => {
    vi.stubEnv("AI_PROVIDER_API_URL", "https://api.together.test/v1/chat/completions");
    vi.stubEnv("AI_PROVIDER_MODEL", "Qwen/Qwen3.7-Plus");

    const togetherGradeJson = {
      totalScore: 8.75,
      rawPoints: 87.5,
      confidence: 0.82,
      breakdown: [
        {
          section: "Subiectul I",
          item: "1",
          maxPoints: 100,
          awardedPoints: 87.5,
          feedback: "Aproape corect.",
          confidence: 0.9,
          studentEvidence: "Poza 1: răspunsul este vizibil.",
          rubricEvidence: "Barem: se acordă 87,5 puncte.",
        },
      ],
      unclearWorkWarnings: [],
      manualReviewNotes: [],
    };

    const jsonStr = JSON.stringify(togetherGradeJson);
    const sseBody = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: jsonStr } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");

    const mockFetch = vi.fn(async () => {
      return new Response(sseBody, {
        headers: { "content-type": "text/event-stream" },
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const formData = new FormData();
    formData.append("examId", exams[0]?.id ?? "missing");
    formData.append(
      "work",
      new File([new Uint8Array([1, 2, 3])], "page1.jpg", { type: "image/jpeg" }),
    );
    formData.append(
      "work",
      new File([new Uint8Array([4, 5, 6])], "page2.jpg", { type: "image/jpeg" }),
    );
    const request = new Request("http://localhost/api/grade", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.result).toMatchObject({
      totalScore: 8.75,
      rawPoints: 87.5,
      model: "Qwen/Qwen3.7-Plus",
      pipelineVersion: "2026-07-17.1",
    });
    expect(body.result.breakdown).toHaveLength(1);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://api.together.test/v1/chat/completions");
    expect(calledInit.headers).toMatchObject({
      authorization: "Bearer test-key",
    });

    const sentBody = JSON.parse(calledInit.body as string);
    expect(sentBody.model).toBe("Qwen/Qwen3.7-Plus");
    expect(sentBody.stream).toBe(true);
    expect(sentBody.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "iabacu_bac_grading_result" },
    });
    expect(sentBody.reasoning).toEqual({ enabled: false });

    const userContent = sentBody.messages[1].content;
    const imageBlocks = userContent.filter(
      (block: Record<string, unknown>) => block.type === "image_url",
    );
    expect(imageBlocks).toHaveLength(2);
    for (const block of imageBlocks) {
      expect(block.image_url).not.toHaveProperty("detail");
      expect(block.image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    }
  });

  it("restores quota when the provider returns a malformed response", async () => {
    vi.stubEnv("AI_PROVIDER_API_URL", "https://api.together.test/v1/chat/completions");
    vi.stubEnv("AI_PROVIDER_MODEL", "Qwen/Qwen3.7-Plus");

    const sseBody = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "{}" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(sseBody, {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );

    const response = await POST(gradeRequest());
    expect(response.status).toBe(500);
    expect(releaseAiUsage).toHaveBeenCalledWith("corrector");
  });

  it("restores quota when the provider returns 429", async () => {
    vi.stubEnv("AI_PROVIDER_API_URL", "https://api.together.test/v1/chat/completions");
    vi.stubEnv("AI_PROVIDER_MODEL", "Qwen/Qwen3.7-Plus");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 })),
    );

    const response = await POST(gradeRequest());
    expect(response.status).toBe(502);
    expect(releaseAiUsage).toHaveBeenCalledWith("corrector");
  });

  it("restores quota when provider output is truncated", async () => {
    vi.stubEnv("AI_PROVIDER_API_URL", "https://api.together.test/v1/chat/completions");
    vi.stubEnv("AI_PROVIDER_MODEL", "Qwen/Qwen3.7-Plus");

    const sseBody = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"totalScore":8' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ finish_reason: "length" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(sseBody, {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );

    const response = await POST(gradeRequest());
    expect(response.status).toBe(502);
    expect(releaseAiUsage).toHaveBeenCalledWith("corrector");
  });

  it("restores quota when grading is cancelled", async () => {
    vi.stubEnv("AI_PROVIDER_API_URL", "https://api.together.test/v1/chat/completions");
    vi.stubEnv("AI_PROVIDER_MODEL", "Qwen/Qwen3.7-Plus");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("cancelled", "AbortError");
      }),
    );

    const response = await POST(gradeRequest());
    expect(response.status).toBe(408);
    expect(releaseAiUsage).toHaveBeenCalledWith("corrector");
  });
});
