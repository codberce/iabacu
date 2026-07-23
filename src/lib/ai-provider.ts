export type AiEndpointKind = "chat-completions" | "messages";

export type RawAiProviderConfig = {
  apiKey: string;
  apiUrl: string;
  model: string;
};

export type AiProviderConfig = RawAiProviderConfig & {
  endpointKind: AiEndpointKind;
};

export function normalizeAiProviderConfig(
  config: RawAiProviderConfig,
): AiProviderConfig {
  const apiUrl = new URL(config.apiUrl.trim()).toString();
  const endpointKind = new URL(apiUrl).pathname.endsWith("/messages")
    ? "messages"
    : "chat-completions";

  return {
    apiKey: config.apiKey,
    apiUrl,
    model: config.model.trim(),
    endpointKind,
  };
}

export function aiProviderHeaders(
  config: AiProviderConfig,
): Record<string, string> {
  if (config.endpointKind === "messages") {
    return {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
    };
  }

  return {
    "content-type": "application/json",
    ...(config.apiKey
      ? { authorization: `Bearer ${config.apiKey}` }
      : {}),
  };
}

export function aiChatReasoningOptions(model: string) {
  const normalizedModel = model.trim().toLowerCase();

  return normalizedModel.includes("gpt-oss")
    ? { reasoning_effort: "low" as const }
    : { reasoning: { enabled: false } };
}
