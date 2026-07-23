import {
  aiUsageHeaders,
  releaseAiUsage,
  type AiFeature,
  type AiUsageAllowance,
} from "@/lib/ai-usage";

export const AI_PIPELINE_VERSION = "2026-07-17.1";

export function aiRequestHeaders(
  allowance: AiUsageAllowance,
  requestId: string,
) {
  return {
    ...aiUsageHeaders(allowance),
    "x-ai-request-id": requestId,
    "x-ai-pipeline-version": AI_PIPELINE_VERSION,
  };
}

export function aiProviderSignal(request: Request, timeoutMs: number) {
  return AbortSignal.any([
    request.signal,
    AbortSignal.timeout(timeoutMs),
  ]);
}

export function aiRequestError(error: unknown, fallback: string) {
  if (error instanceof Error && error.name === "IncompleteGradeResponseError") {
    return {
      message:
        "Corectarea AI s-a oprit înainte să acopere toată lucrarea. Încearcă din nou; această încercare nu consumă din limita zilnică.",
      status: 502,
    } as const;
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      message: "Serviciul AI a răspuns prea greu. Încearcă din nou.",
      status: 504,
    } as const;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      message: "Cererea AI a fost oprită.",
      status: 408,
    } as const;
  }
  return { message: fallback, status: 500 } as const;
}

export async function safelyReleaseAiUsage(
  feature: AiFeature,
  allowance: AiUsageAllowance | undefined,
) {
  if (!allowance || allowance.unlimited) return;
  if (allowance.bonusCreditId) {
    await releaseAiUsage(feature, allowance);
  } else {
    await releaseAiUsage(feature);
  }
}

export function logAiRequest(event: {
  requestId: string;
  feature: AiFeature;
  model: string;
  status:
    | "success"
    | "stream_started"
    | "provider_error"
    | "invalid_output"
    | "error";
  startedAt: number;
  examId: string;
  inputBytes?: number;
  inputImages?: number;
  providerStatus?: number;
}) {
  console.info("ai_request", {
    ...event,
    durationMs: Date.now() - event.startedAt,
  });
}
