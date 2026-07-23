import { NextResponse } from "next/server";
import {
  baremChatRequestSchema,
  baremChatGroundingHeaders,
  buildBaremChatPayload,
  parseAiChatMessage,
} from "@/lib/barem-chat";
import { getOlympiadWorkspaceByExamId } from "@/lib/competitions";
import { loadExamContext } from "@/lib/exam-context";
import { getExamById } from "@/lib/exams";
import { buildOlympiadBaremChatPayload } from "@/lib/olympiad-barem-chat";
import { loadOlympiadContext } from "@/lib/olympiad-context";
import { normalizeAiProviderConfig, aiProviderHeaders } from "@/lib/ai-provider";
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

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Env invalid.", 500);
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
    const providerPayload = olympiadWorkspace
      ? buildOlympiadBaremChatPayload(
          env.endpointKind,
          env.model,
          exam,
          context,
          parsed.data.messages,
        )
      : buildBaremChatPayload(
          env.endpointKind,
          env.model,
          exam,
          context,
          parsed.data.messages,
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

    const message = parseAiChatMessage(await response.json());
    logAiRequest({
      requestId,
      feature: "question",
      model: env.model,
      status: "success",
      startedAt,
      examId: exam.id,
    });
    return NextResponse.json(
      { message },
      {
        headers: allowance
          ? {
              ...contextHeaders,
              ...aiRequestHeaders(allowance, requestId),
            }
          : contextHeaders,
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
