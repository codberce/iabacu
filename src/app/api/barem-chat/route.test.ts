// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exams } from "@/lib/exams";

vi.mock("@/lib/ai-usage", () => ({
  claimAiUsage: vi.fn(async () => ({
    unlimited: false,
    used: 1,
    remaining: 9,
    limit: 10,
  })),
  releaseAiUsage: vi.fn(async () => undefined),
  aiUsageHeaders: vi.fn(() => ({
    "x-ai-limit": "10",
    "x-ai-remaining": "9",
  })),
  aiUsageErrorResponse: vi.fn(() => null),
}));

import { POST } from "./route";
import { releaseAiUsage } from "@/lib/ai-usage";

function setValidEnv() {
  vi.stubEnv("AI_PROVIDER_API_KEY", "test-key");
  vi.stubEnv("AI_PROVIDER_API_URL", "https://api.example.test/v1/chat/completions");
  vi.stubEnv("AI_PROVIDER_CHAT_API_URL", "https://chat.example.test/v1/chat/completions");
  vi.stubEnv("AI_PROVIDER_CHAT_MODEL", "example-chat-model");
}

function chatRequest(body: unknown) {
  return new Request("http://localhost/api/barem-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skipIf(exams.length === 0)("barem chat API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setValidEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns a model explanation for a valid request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          content: [{ type: "text", text: "Explicatie clara." }],
        }),
      ),
    );

    const response = await POST(
      chatRequest({
        examId: exams[0].id,
        messages: [{ role: "user", content: "Explica itemul 1." }],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Explicatie clara.",
    });
    expect(response.headers.get("x-ai-remaining")).toBe("9");
    expect(response.headers.get("x-ai-pipeline-version")).toBe(
      "2026-07-17.1",
    );
    expect(response.headers.get("x-ai-context-target")).toBe("itemul%201");
    expect(response.headers.get("x-ai-context-subject-pages")).not.toBeNull();
    expect(response.headers.get("x-ai-context-barem-pages")).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "https://chat.example.test/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining("example-chat-model"),
        headers: expect.objectContaining({ authorization: "Bearer test-key" }),
      }),
    );
  });

  it("rejects invalid requests", async () => {
    const response = await POST(
      chatRequest({ examId: exams[0].id, messages: [] }),
    );
    expect(response.status).toBe(400);
  });

  it("returns a safe error and restores quota when the provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("private upstream error", { status: 503 })),
    );

    const response = await POST(
      chatRequest({
        examId: exams[0].id,
        messages: [{ role: "user", content: "Explică itemul 1." }],
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Serviciul AI nu a putut genera explicația. Încearcă din nou.",
    });
    expect(releaseAiUsage).toHaveBeenCalledWith("question");
  });

  it("fails fast when env is missing", async () => {
    vi.stubEnv("AI_PROVIDER_API_URL", "");
    vi.stubEnv("AI_PROVIDER_CHAT_API_URL", "");
    const response = await POST(
      chatRequest({
        examId: exams[0].id,
        messages: [{ role: "user", content: "Explica." }],
      }),
    );
    expect(response.status).toBe(500);
  });

  it("rejects an unknown exam", async () => {
    const response = await POST(
      chatRequest({
        examId: "missing-exam",
        messages: [{ role: "user", content: "Explica." }],
      }),
    );
    expect(response.status).toBe(404);
  });
});
