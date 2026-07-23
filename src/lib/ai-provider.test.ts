import { describe, expect, it } from "vitest";
import { aiProviderHeaders, normalizeAiProviderConfig } from "./ai-provider";

describe("AI provider config", () => {
  it("uses OpenAI-compatible chat completions by default", () => {
    const config = normalizeAiProviderConfig({
      apiKey: "key",
      apiUrl: "https://api.example.com/v1/chat/completions",
      model: "example-chat-model",
    });

    expect(config).toMatchObject({
      apiUrl: "https://api.example.com/v1/chat/completions",
      endpointKind: "chat-completions",
      model: "example-chat-model",
    });
    expect(aiProviderHeaders(config)).toHaveProperty(
      "authorization",
      "Bearer key",
    );
  });

  it("omits authorization for a keyless local provider", () => {
    const config = normalizeAiProviderConfig({
      apiKey: "",
      apiUrl: "http://localhost:11434/v1/chat/completions",
      model: "local-model",
    });

    expect(aiProviderHeaders(config)).toEqual({
      "content-type": "application/json",
    });
  });

  it("supports Anthropic-compatible Messages endpoints", () => {
    const config = normalizeAiProviderConfig({
      apiKey: "key",
      apiUrl: "https://api.example.com/v1/messages",
      model: "example-messages-model",
    });

    expect(config.endpointKind).toBe("messages");
    expect(aiProviderHeaders(config)).toMatchObject({
      "anthropic-version": "2023-06-01",
      "x-api-key": "key",
    });
  });
});
