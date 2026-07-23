import { NextResponse } from "next/server";
import {
  baremChatRequestSchema,
  baremChatCitations,
  baremChatGroundingHeaders,
  buildBaremChatPayload,
  parseAiChatDelta,
  parseAiChatErrorMessage,
  parseAiChatMessage,
} from "@/lib/barem-chat";
import {
  encodeBaremChatStreamEvent,
  type BaremChatStreamEvent,
} from "@/lib/barem-chat-stream";
import { getOlympiadWorkspaceByExamId } from "@/lib/competitions";
import { loadExamContext } from "@/lib/exam-context";
import { getExamById } from "@/lib/exams";
import { buildOlympiadBaremChatPayload } from "@/lib/olympiad-barem-chat";
import { loadOlympiadContext } from "@/lib/olympiad-context";
import { normalizeAiProviderConfig, aiProviderHeaders } from "@/lib/ai-provider";
import { requestBodyTooLarge, unsupportedContentType } from "@/lib/api-safety";
import { aiUsageErrorResponse, claimAiUsage } from "@/lib/ai-usage";
import type { AiUsageAllowance } from "@/lib/ai-usage";
import {
  aiProviderSignal,
  aiRequestError,
  aiRequestHeaders,
  logAiRequest,
  safelyReleaseAiUsage,
} from "@/lib/ai-runtime";

export const runtime = "nodejs";
export const maxDuration = 45;

function jsonError(
  message: string,
  status: number,
  headers?: Record<string, string>,
) {
  return NextResponse.json({ error: message }, { status, headers });
}

function getEnv() {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const apiUrl =
    process.env.AI_PROVIDER_CHAT_API_URL ?? process.env.AI_PROVIDER_API_URL;
  const model =
    process.env.AI_PROVIDER_CHAT_MODEL ?? process.env.AI_PROVIDER_MODEL;

  if (!apiUrl || !model) {
    throw new Error(
      "Configurația furnizorului AI este incompletă.",
    );
  }

  return normalizeAiProviderConfig({ apiKey: apiKey ?? "", apiUrl, model });
}

function providerEvent(data: string):
  | { type: "ignore" }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error" } {
  const trimmed = data.trim();
  if (!trimmed) return { type: "ignore" };
  if (trimmed === "[DONE]") return { type: "done" };

  let event: unknown;
  try {
    event = JSON.parse(trimmed);
  } catch {
    return { type: "error" };
  }
  if (!event || typeof event !== "object") return { type: "error" };

  const type = "type" in event && typeof event.type === "string"
    ? event.type
    : undefined;
  const finishReason = "choices" in event && Array.isArray(event.choices)
    ? event.choices.find(
        (choice): choice is { finish_reason: string } =>
          Boolean(choice) &&
          typeof choice === "object" &&
          "finish_reason" in choice &&
          typeof choice.finish_reason === "string" &&
          choice.finish_reason.length > 0,
      )?.finish_reason
    : undefined;
  const stopReason = "delta" in event && event.delta && typeof event.delta === "object" &&
    "stop_reason" in event.delta && typeof event.delta.stop_reason === "string"
    ? event.delta.stop_reason
    : undefined;
  if (finishReason || stopReason) {
    const reason = finishReason ?? stopReason;
    return reason === "stop" || reason === "end_turn"
      ? { type: "done" }
      : { type: "error" };
  }
  if (type === "message_stop" || type === "response.completed") {
    return { type: "done" };
  }
  if (type === "error") return { type: "error" };

  return { type: "delta", text: parseAiChatDelta(event) };
}

function textStreamFromSse(input: {
  response: Response;
  grounding: BaremChatStreamEvent;
  allowance: AiUsageAllowance | undefined;
  requestId: string;
  model: string;
  startedAt: number;
  examId: string;
}) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: BaremChatStreamEvent) =>
        controller.enqueue(encodeBaremChatStreamEvent(event));
      const fail = async () => {
        emit({ type: "error", error: "Răspunsul s-a întrerupt. Încearcă din nou." });
        await safelyReleaseAiUsage("question", input.allowance);
        logAiRequest({
          requestId: input.requestId,
          feature: "question",
          model: input.model,
          status: "invalid_output",
          startedAt: input.startedAt,
          examId: input.examId,
        });
      };

      emit(input.grounding);
      const reader = input.response.body?.getReader();
      if (!reader) {
        await fail();
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let completed = false;

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            const data = trimmed.startsWith("data:")
              ? trimmed.slice("data:".length)
              : trimmed.startsWith("{")
                ? trimmed
                : undefined;
            if (data === undefined) continue;

            const event = providerEvent(data);
            if (event.type === "error") throw new Error("Invalid provider stream");
            if (event.type === "done") {
              completed = true;
              continue;
            }
            if (event.type === "delta" && event.text) {
              answer += event.text;
              emit(event);
            }
          }
        }

        const trailing = buffer.trim();
        if (trailing) {
          const event = providerEvent(
            trailing.startsWith("data:") ? trailing.slice("data:".length) : trailing,
          );
          if (event.type === "error") throw new Error("Invalid provider stream");
          if (event.type === "done") completed = true;
          if (event.type === "delta" && event.text) {
            answer += event.text;
            emit(event);
          }
        }

        if (!completed || parseAiChatErrorMessage(answer)) {
          await fail();
        } else {
          emit({ type: "done" });
        }
      } catch {
        await fail();
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Env invalid.", 500);
  }

  if (unsupportedContentType(request, "application/json")) {
    return NextResponse.json(
      { error: "Conținutul cererii nu este acceptat." },
      { status: 415 },
    );
  }
  if (requestBodyTooLarge(request, "json")) {
    return NextResponse.json(
      { error: "Corpul cererii depășește limita." },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("JSON invalid.", 400);
  }

  const parsed = baremChatRequestSchema.safeParse(payload);
  if (!parsed.success) return jsonError("Cerere invalida.", 400);

  const olympiadWorkspace = getOlympiadWorkspaceByExamId(parsed.data.examId);
  const exam = olympiadWorkspace?.exam ?? getExamById(parsed.data.examId);
  if (!exam) return jsonError("Examen necunoscut.", 404);

  let allowance: AiUsageAllowance | undefined;
  try {
    allowance = await claimAiUsage("question");
  } catch (error) {
    const response = aiUsageErrorResponse(error);
    if (response) return response;
    return jsonError("Nu am putut verifica limita zilnică.", 500);
  }

  try {
    const context = olympiadWorkspace
      ? await loadOlympiadContext(
          exam.id,
          olympiadWorkspace.subjectDocument,
          olympiadWorkspace.solutionDocument,
        )
      : await loadExamContext(exam.contextPath);
    const contextHeaders = baremChatGroundingHeaders(
      context,
      parsed.data.messages,
    );
    const groundingEvent: BaremChatStreamEvent = {
      type: "grounding",
      citations: baremChatCitations(context, parsed.data.messages),
    };
    const providerPayload = olympiadWorkspace
      ? buildOlympiadBaremChatPayload(
          env.endpointKind,
          env.model,
          exam,
          context,
          parsed.data.messages,
          { stream: true },
        )
      : buildBaremChatPayload(
          env.endpointKind,
          env.model,
          exam,
          context,
          parsed.data.messages,
          { stream: true },
        );

    const response = await fetch(env.apiUrl, {
      method: "POST",
      headers: aiProviderHeaders(env),
      body: JSON.stringify(providerPayload),
      signal: aiProviderSignal(request, 40_000),
    });

    if (!response.ok) {
      await safelyReleaseAiUsage("question", allowance);
      logAiRequest({
        requestId,
        feature: "question",
        model: env.model,
        status: "provider_error",
        startedAt,
        examId: exam.id,
        providerStatus: response.status,
      });
      return jsonError(
        response.status === 429
          ? "Serviciul AI este momentan aglomerat. Încearcă din nou."
          : "Serviciul AI nu a putut genera explicația. Încearcă din nou.",
        502,
        allowance ? aiRequestHeaders(allowance, requestId) : undefined,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      const body = await response.json();
      const text = parseAiChatMessage(body);
      logAiRequest({
        requestId,
        feature: "question",
        model: env.model,
        status: "success",
        startedAt,
        examId: exam.id,
      });
      return new Response(
        new Blob([
          encodeBaremChatStreamEvent(groundingEvent),
          encodeBaremChatStreamEvent({
            type: "delta",
            text,
          }),
          encodeBaremChatStreamEvent({ type: "done" }),
        ]).stream(),
        {
          headers: {
            "content-type": "application/x-ndjson; charset=utf-8",
            ...contextHeaders,
            ...(allowance ? aiRequestHeaders(allowance, requestId) : {}),
          },
        },
      );
    }

    logAiRequest({
      requestId,
      feature: "question",
      model: env.model,
      status: "stream_started",
      startedAt,
      examId: exam.id,
    });
    return new Response(
      textStreamFromSse({
        response,
        grounding: groundingEvent,
        allowance,
        requestId,
        model: env.model,
        startedAt,
        examId: exam.id,
      }),
      {
        headers: {
          "cache-control": "no-cache, no-transform",
          "content-type": "application/x-ndjson; charset=utf-8",
          ...contextHeaders,
          ...(allowance ? aiRequestHeaders(allowance, requestId) : {}),
        },
      },
    );
  } catch (error) {
    await safelyReleaseAiUsage("question", allowance);
    const failure = aiRequestError(
      error,
      "Explicația nu a putut fi generată. Încearcă din nou.",
    );
    logAiRequest({
      requestId,
      feature: "question",
      model: env.model,
      status: "error",
      startedAt,
      examId: exam.id,
    });
    return jsonError(
      failure.message,
      failure.status,
      allowance ? aiRequestHeaders(allowance, requestId) : undefined,
    );
  }
}
