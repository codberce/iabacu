// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exams } from "@/lib/exams";
import { releaseAiUsage } from "@/lib/ai-usage";

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

function setValidEnv() {
  vi.stubEnv("AI_PROVIDER_API_KEY", "test-key");
  vi.stubEnv("AI_PROVIDER_API_URL", "https://api.example.test/v1/chat/completions");
  vi.stubEnv("AI_PROVIDER_CHAT_API_URL", "https://chat.example.test/v1/chat/completions");
  vi.stubEnv("AI_PROVIDER_CHAT_MODEL", "example-chat-model");
}

function chatRequest(body: unknown) {
  return new Request("http://localhost/api/barem-chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skipIf(exams.length === 0)("barem chat streaming API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setValidEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("marks an unterminated provider stream as an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          'data: {"choices":[{"delta":{"content":"Parțial"}}]}\n\n',
          { headers: { "content-type": "text/event-stream" } },
        ),
      ),
    );

    const response = await POST(
      chatRequest({
        examId: exams[0].id,
        messages: [{ role: "user", content: "Explica itemul 1." }],
      }),
    );
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(events).toEqual([
      expect.objectContaining({ type: "grounding" }),
      { type: "delta", text: "Parțial" },
      expect.objectContaining({ type: "error" }),
    ]);
    expect(releaseAiUsage).toHaveBeenCalledTimes(1);
  });

  it("sends low reasoning effort to GPT-OSS to avoid length interruptions", async () => {
    vi.stubEnv("AI_PROVIDER_CHAT_MODEL", "openai/gpt-oss-120b");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("data: [DONE]\n\n", {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );

    await POST(
      chatRequest({
        examId: exams[0].id,
        messages: [{ role: "user", content: "Explică itemul 1." }],
      }),
    );

    const providerRequest = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(providerRequest?.body))).toMatchObject({
      reasoning_effort: "low",
    });
  });

  it("accepts a follow-up after an assistant response longer than a user question", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("data: [DONE]\n\n", {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );

    const response = await POST(
      chatRequest({
        examId: exams[0].id,
        messages: [
          { role: "user", content: "Explică problema 1." },
          { role: "assistant", content: "x".repeat(4001) },
          { role: "user", content: "Ce este o primitivă?" },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("streams model deltas with explicit completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          [
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Pasul 1"}}\n\n',
            'data: {"choices":[{"delta":{"content":" si pasul 2"}}]}\n\n',
            "data: [DONE]\n\n",
          ].join(""),
          {
            headers: { "content-type": "text/event-stream" },
          },
        ),
      ),
    );

    const response = await POST(
      chatRequest({
        examId: exams[0].id,
        messages: [{ role: "user", content: "Explica itemul 1." }],
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ai-remaining")).toBe("9");
    expect(response.headers.get("x-ai-pipeline-version")).toBe(
      "2026-07-17.1",
    );
    expect(response.headers.get("x-ai-context-target")).toBe("itemul%201");
    expect(response.headers.get("x-ai-context-subject-pages")).not.toBeNull();
    expect(response.headers.get("x-ai-context-barem-pages")).not.toBeNull();

    const body = await response.text();
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const events = body
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events).toEqual([
      expect.objectContaining({ type: "grounding", citations: expect.any(Array) }),
      { type: "delta", text: "Pasul 1" },
      { type: "delta", text: " si pasul 2" },
      { type: "done" },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://chat.example.test/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringMatching(/example-chat-model[\s\S]*"stream":true/),
        headers: expect.objectContaining({ authorization: "Bearer test-key" }),
      }),
    );
  });

  it("rejects unsupported content type", async () => {
    const request = new Request("http://localhost/api/barem-chat/stream", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({
        examId: exams[0].id,
        messages: [{ role: "user", content: "Explica." }],
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: "Conținutul cererii nu este acceptat.",
    });
  });

  it("rejects request body exceeding size limit", async () => {
    const request = new Request("http://localhost/api/barem-chat/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(256 * 1024 + 1),
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "Corpul cererii depășește limita.",
    });
  });

  it("turns a serialized provider error into a stream error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          [
            'data: {"choices":[{"delta":{"content":"{\\\"type\\\":\\\"error\\\","}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"\\\"error\\\":\\\"Răspunsul s-a întrerupt. Încearcă din nou.\\\"}"}}]}\n\n',
            "data: [DONE]\n\n",
          ].join(""),
          { headers: { "content-type": "text/event-stream" } },
        ),
      ),
    );

    const response = await POST(
      chatRequest({
        examId: exams[0].id,
        messages: [{ role: "user", content: "Explică itemul 1." }],
      }),
    );
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(events.at(-1)).toEqual(expect.objectContaining({ type: "error" }));
    expect(events).not.toContainEqual({ type: "done" });
    expect(releaseAiUsage).toHaveBeenCalledTimes(1);
  });
});
