import { NextResponse } from "next/server";
import { loadExamContext } from "@/lib/exam-context";
import {
  buildAiProviderGradePayload,
  collectStreamingGradeResponse,
  parseAiProviderGradeResponse,
  platformGradeContext,
} from "@/lib/grading";
import { getExamById } from "@/lib/exams";
import { getOlympiadWorkspaceByExamId } from "@/lib/competitions";
import { loadOlympiadContext } from "@/lib/olympiad-context";
import { normalizeAiProviderConfig, aiProviderHeaders } from "@/lib/ai-provider";
import { aiUsageErrorResponse, claimAiUsage } from "@/lib/ai-usage";
import type { AiUsageAllowance } from "@/lib/ai-usage";
import { unsupportedContentType, requestBodyTooLarge } from "@/lib/api-safety";
import {
  validateAndNormalizeWorkImage,
  WorkImageValidationError,
  type NormalizedWorkImage,
} from "@/lib/work-image-validation";
import {
  aiProviderSignal,
  AI_PIPELINE_VERSION,
  aiRequestError,
  aiRequestHeaders,
  logAiRequest,
  safelyReleaseAiUsage,
} from "@/lib/ai-runtime";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxFiles = 8;
const maxFileBytes = 7 * 1024 * 1024;
const maxTotalBytes = 28 * 1024 * 1024;
const maxPixels = 40_000_000;
const maxEdge = 2048;

function jsonError(
  message: string,
  status: number,
  headers?: Record<string, string>,
) {
  return NextResponse.json({ error: message }, { status, headers });
}

function getEnv() {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const apiUrl = process.env.AI_PROVIDER_API_URL;
  const model = process.env.AI_PROVIDER_MODEL;

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

  if (unsupportedContentType(request, "multipart/form-data")) {
    return jsonError("Tip de conținut neacceptat.", 415);
  }
  if (requestBodyTooLarge(request, "multipart")) {
    return jsonError("Cererea depășește limita de dimensiune.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Formular invalid.", 400);
  }

  const examId = String(formData.get("examId") ?? "");
  const olympiadWorkspace = getOlympiadWorkspaceByExamId(examId);
  const exam = olympiadWorkspace?.exam ?? getExamById(examId);
  if (!exam) return jsonError("Examen necunoscut.", 404);

  const files = formData
    .getAll("work")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) return jsonError("Încarcă cel puțin o poză.", 400);
  if (files.length > maxFiles) {
    return jsonError(`Poți încărca maximum ${maxFiles} poze.`, 400);
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > maxTotalBytes) {
    return jsonError("Pozele depășesc limita totală de 28 MB.", 413);
  }

  const images: NormalizedWorkImage[] = [];
  try {
    // Decode sequentially to avoid multiplying Sharp's peak memory use when a
    // student uploads several high-resolution phone photos at once.
    for (const file of files) {
      images.push(await validateAndNormalizeWorkImage(file, {
        maxBytes: maxFileBytes,
        maxPixels,
        maxEdge,
      }));
    }
  } catch (error) {
    if (error instanceof WorkImageValidationError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Imaginea nu poate fi procesată.", 400);
  }

  let allowance: AiUsageAllowance | undefined;
  try {
    allowance = await claimAiUsage("corrector");
  } catch (error) {
    const response = aiUsageErrorResponse(error);
    if (response) return response;
    return jsonError("Nu am putut verifica limita zilnică.", 500);
  }

  try {
    const context =
      platformGradeContext(exam) ??
      (olympiadWorkspace
        ? await loadOlympiadContext(
            exam.id,
            olympiadWorkspace.subjectDocument,
            olympiadWorkspace.solutionDocument,
          )
        : await loadExamContext(exam.contextPath));
    const payload = buildAiProviderGradePayload(
      env.endpointKind,
      env.model,
      exam,
      context,
      images,
    );

    const response = await fetch(env.apiUrl, {
      method: "POST",
      headers: aiProviderHeaders(env),
      body: JSON.stringify(payload),
      signal: aiProviderSignal(request, 58_000),
    });

    if (!response.ok) {
      await safelyReleaseAiUsage("corrector", allowance);
      logAiRequest({
        requestId,
        feature: "corrector",
        model: env.model,
        status: "provider_error",
        startedAt,
        examId,
        inputBytes: totalBytes,
        inputImages: files.length,
        providerStatus: response.status,
      });
      return jsonError(
        response.status === 429
          ? "Serviciul AI este momentan aglomerat. Încearcă din nou."
          : "Serviciul AI nu a putut finaliza corectarea. Încearcă din nou.",
        502,
        allowance ? aiRequestHeaders(allowance, requestId) : undefined,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const providerResponse = contentType.includes("text/event-stream")
      ? await collectStreamingGradeResponse(response)
      : await response.json();

    const parsedResult = parseAiProviderGradeResponse(providerResponse, exam);
    const result = {
      ...parsedResult,
      model: env.model,
      pipelineVersion: AI_PIPELINE_VERSION,
    };
    logAiRequest({
      requestId,
      feature: "corrector",
      model: env.model,
      status: "success",
      startedAt,
      examId,
      inputBytes: totalBytes,
      inputImages: files.length,
    });
    return NextResponse.json(
      { result },
      {
        headers: allowance
          ? aiRequestHeaders(allowance, requestId)
          : undefined,
      },
    );
  } catch (error) {
    await safelyReleaseAiUsage("corrector", allowance);
    const failure = aiRequestError(
      error,
      "Corectarea nu a putut fi finalizată. Încearcă din nou.",
    );
    logAiRequest({
      requestId,
      feature: "corrector",
      model: env.model,
      status: "invalid_output",
      startedAt,
      examId,
      inputBytes: totalBytes,
      inputImages: files.length,
    });
    return jsonError(
      failure.message,
      failure.status,
      allowance ? aiRequestHeaders(allowance, requestId) : undefined,
    );
  }
}
