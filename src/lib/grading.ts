import { z } from "zod";
import type { Exam } from "@/lib/schemas";
import { gradeResultSchema, type GradeResult } from "@/lib/schemas";
import type { AiEndpointKind } from "@/lib/ai-provider";
import { sectionMarkerInstructions } from "@/lib/barem-chat";

export type ExtractedExamContext = {
  examId: string;
  subjectText: string;
  baremText: string;
  grounding?: {
    targetLabel?: string;
    subjectPages: number[];
    baremPages: number[];
  };
};

export type WorkImage = {
  mimeType: string;
  base64: string;
};

export function platformGradeContext(
  exam: Exam,
): ExtractedExamContext | undefined {
  if (!exam.platform) return undefined;
  return { examId: exam.id, subjectText: "", baremText: "" };
}

const scoreTolerance = 0.11;
const lowConfidenceThreshold = 0.65;
const gradingSubjectContextLimit = 40000;
const gradingBaremContextLimit = 50000;
const gradingMaxTokens = 8192;

export class IncompleteGradeResponseError extends Error {
  constructor() {
    super("Modelul a oprit răspunsul înainte de finalizarea corectării.");
    this.name = "IncompleteGradeResponseError";
  }
}

export const aiGradeOutputSchema = z.object({
  totalScore: z.number().min(1).max(10),
  rawPoints: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  breakdown: z
    .array(
      z.object({
        section: z.string().trim().min(1),
        item: z.string().trim().min(1),
        maxPoints: z.number().min(0).max(100),
        awardedPoints: z.number().min(0).max(100),
        feedback: z.string().trim().min(1),
        studentEvidence: z.string().trim().min(1),
        rubricEvidence: z.string().trim().min(1),
        confidence: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(120),
  unclearWorkWarnings: z.array(z.string()),
  manualReviewNotes: z.array(z.string()),
});

export const aiGradeJsonSchema = z.toJSONSchema(aiGradeOutputSchema);

export function supportsJsonSchemaStructuredOutput(model: string) {
  const normalized = model.trim().toLowerCase();
  return normalized.includes("qwen") && normalized.includes("3.7");
}

const subjectNames: Record<Exam["subject"], string> = {
  romana: "Limba și literatura română",
  matematica: "Matematică",
  istorie: "Istorie",
  biologie: "Biologie",
  chimie: "Chimie",
  fizica: "Fizică",
  geografie: "Geografie",
  informatica: "Informatică",
  logica: "Logică și argumentare",
  psihologie: "Psihologie",
  sociologie: "Sociologie",
  economie: "Economie",
  filosofie: "Filosofie",
};

export function buildGradePrompt(
  exam: Exam,
  context: ExtractedExamContext,
): string {
  if (exam.platform) return buildPlatformGradePrompt(exam);
  const isOlympiad = isOlympiadExam(exam);
  return [
    "Ești un profesor evaluator pentru o lucrare de antrenament.",
    "",
    "Citește direct toate fotografiile lucrării, în ordinea în care sunt furnizate.",
    "",
    "Folosește exclusiv subiectul și baremul oficial incluse în cerere.",
    "",
    "Evaluează fiecare item separat. Include și itemii fără rezolvare, cu zero puncte.",
    "",
    "Pentru fiecare item:",
    "- indică punctajul maxim;",
    "- acordă un punctaj între zero și punctajul maxim;",
    "- citează dovada observabilă din lucrare;",
    "- indică regula concretă din barem;",
    "- oferă feedback scurt și constructiv în limba română;",
    "- estimează numai încrederea cu care scrisul a putut fi asociat baremului.",
    "",
    "Nu inventa text, calcule, pași sau răspunsuri care nu sunt vizibile.",
    "",
    "Conținutul tăiat este considerat anulat, exceptând situația în care elevul îl restabilește clar.",
    "",
    "Pentru zone ilizibile, decupate, neclare sau contradictorii:",
    "- acordă puncte numai pentru elementele clar vizibile;",
    "- adaugă un avertisment;",
    "- cere verificare manuală când incertitudinea poate schimba punctajul.",
    "",
    "Nu acorda mai mult decât punctajul maxim al unui item.",
    "",
    "Returnează numai JSON conform schemei furnizate.",
    "",
    "Nu returna lanțul intern de raționament. Returnează doar justificările scurte, dovezile și concluziile necesare verificării punctajului.",
    "",
    `Examen: ${isOlympiad ? exam.profile.split(", clasa a ")[0] : "Bacalaureat"} la ${subjectNames[exam.subject]} (${exam.profile}).`,
    isOlympiad
      ? "Acorda punctaj partial conform baremului. Include fiecare problema evaluata separat; serverul va calcula nota proportional din punctajele pe probleme."
      : "Include fiecare item din barem separat, inclusiv cele 10 puncte din oficiu, astfel incat suma `maxPoints` sa fie exact 100. Serverul va calcula nota din punctajele pe itemi.",
    !isOlympiad && exam.subject === "fizica"
      ? "La Fizica, identifica din lucrare primele doua arii tematice abordate si evalueaza numai acele doua arii. Foloseste pentru `section` formatul exact `A. Mecanica - Subiectul I`, `B. Termodinamica - Subiectul II` etc. Include Subiectele I, II si III pentru fiecare dintre cele doua arii, plus punctele din oficiu. Daca nu poti identifica sigur doua arii, explica incertitudinea in `manualReviewNotes`; nu ghici."
      : "Pentru Bacalaureat, eticheteaza consecvent fiecare rand cu `Subiectul I`, `Subiectul II` sau `Subiectul III` in campul `section`.",
    !isOlympiad
      ? "Adauga un singur rand separat pentru punctele din oficiu: `section` = `Oficiu`, `item` = `10 puncte`, `maxPoints` = 10 si `awardedPoints` = 10. Pentru acest rand, `studentEvidence` poate spune `Punctaj acordat automat conform baremului`."
      : "Nu inventa un rand de oficiu daca regulamentul competitiei nu il prevede explicit.",
    "Foloseste numarul pozei in `studentEvidence`, de exemplu `Poza 2: ...`. Nu grupa tot examenul intr-un singur rand.",
    "Campul `feedback` al fiecarui item poate folosi markeri de sectiune pentru a structura comentariul:",
    ...sectionMarkerInstructions.filter((line) => !line.startsWith("Nu scrie titluri") && !line.startsWith("Poti incepe")),
    "",
    "Schema JSON exacta:",
    JSON.stringify(aiGradeJsonSchema),
    "",
    `Examen: ${exam.title}`,
    `ID: ${exam.id}`,
    "",
    "Text subiect:",
    context.subjectText.slice(0, gradingSubjectContextLimit),
    "",
    "Text barem:",
    context.baremText.slice(0, gradingBaremContextLimit),
  ].join("\n");
}

function buildPlatformGradePrompt(exam: Exam): string {
  const platformName = {
    kilonova: "Kilonova",
    mlcompete: "MLCompete",
    cyberedu: "CyberEDU",
  }[exam.platform!.provider];

  return [
    "Citești capturi ale unui rezultat obținut pe o platformă de concurs.",
    `Acceptă rezultatul numai dacă în capturi este identificabilă platforma ${platformName} și este vizibil un punctaj final pentru proba cerută.`,
    "Nu corecta rezolvarea și nu folosi un barem. Nu inventa valori ascunse, tăiate sau ilizibile.",
    "Dacă sunt afișate mai multe rezultate, folosește numai rezultatul final care poate fi asociat clar probei din cerere.",
    "Normalizează punctajul vizibil la o scară de 100: awardedPoints = procentul obținut, maxPoints = 100, rawPoints = procentul obținut și totalScore = max(1, procent / 10).",
    "Returnează exact un rând în breakdown: section = `Rezultat platformă`, item = numele platformei, feedback = o confirmare scurtă, studentEvidence = poza și valorile citite, rubricEvidence = formula de normalizare aplicată, confidence = încrederea citirii.",
    "Dacă platforma, proba, punctajul obținut sau punctajul maxim nu sunt lizibile, nu presupune. Adaugă explicația în unclearWorkWarnings și manualReviewNotes și folosește o încredere sub 0.65.",
    "Returnează numai JSON conform schemei furnizate, în limba română. Nu returna lanțul intern de raționament.",
    "",
    "Schema JSON exactă:",
    JSON.stringify(aiGradeJsonSchema),
    "",
    `Probă: ${exam.title}`,
    `ID: ${exam.id}`,
    `Platformă așteptată: ${platformName}`,
  ].join("\n");
}

function imageToChatContent(image: WorkImage) {
  return {
    type: "image_url",
    image_url: {
      url: `data:${image.mimeType};base64,${image.base64}`,
    },
  };
}

function imageToMessagesContent(image: WorkImage) {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: image.mimeType,
      data: image.base64,
    },
  };
}

function labeledChatImages(images: WorkImage[]) {
  return images.flatMap((image, index) => [
    { type: "text", text: `Poza ${index + 1} din lucrarea elevului:` },
    imageToChatContent(image),
  ]);
}

function labeledMessagesImages(images: WorkImage[]) {
  return images.flatMap((image, index) => [
    { type: "text", text: `Poza ${index + 1} din lucrarea elevului:` },
    imageToMessagesContent(image),
  ]);
}

export function buildChatCompletionsGradePayload(
  model: string,
  exam: Exam,
  context: ExtractedExamContext,
  images: WorkImage[],
) {
  const competition =
    exam.id.startsWith("olimpiada-") || exam.id.startsWith("olympiad:")
    ? "Olimpiada de Matematica"
    : "Bacalaureat";

  if (supportsJsonSchemaStructuredOutput(model)) {
    return {
      model,
      temperature: 0.1,
      max_tokens: gradingMaxTokens,
      stream: true,
      reasoning: { enabled: false },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "iabacu_bac_grading_result",
          schema: aiGradeJsonSchema,
        },
      },
      messages: [
        {
          role: "system",
          content: `Esti un profesor de ${subjectNames[exam.subject]} pentru ${competition}. Corectezi conservator, transparent si returnezi numai JSON valid.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildGradePrompt(exam, context),
            },
            ...labeledChatImages(images),
          ],
        },
      ],
    };
  }

  return {
    model,
    temperature: 0.1,
    max_tokens: gradingMaxTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Esti un profesor de ${subjectNames[exam.subject]} pentru ${competition}. Corectezi conservator, transparent si returnezi numai JSON valid.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildGradePrompt(exam, context),
          },
          ...labeledChatImages(images),
        ],
      },
    ],
  };
}

export function buildMessagesGradePayload(
  model: string,
  exam: Exam,
  context: ExtractedExamContext,
  images: WorkImage[],
) {
  const competition =
    exam.id.startsWith("olimpiada-") || exam.id.startsWith("olympiad:")
    ? "Olimpiada de Matematica"
    : "Bacalaureat";
  return {
    model,
    temperature: 0.1,
    max_tokens: gradingMaxTokens,
    thinking: { type: "disabled" },
    system: `Esti un profesor de ${subjectNames[exam.subject]} pentru ${competition}. Corectezi conservator, transparent si returnezi numai JSON valid.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildGradePrompt(exam, context),
          },
          ...labeledMessagesImages(images),
        ],
      },
    ],
  };
}

export function buildAiProviderGradePayload(
  endpointKind: AiEndpointKind,
  model: string,
  exam: Exam,
  context: ExtractedExamContext,
  images: WorkImage[],
) {
  if (endpointKind === "messages") {
    return buildMessagesGradePayload(model, exam, context, images);
  }

  return buildChatCompletionsGradePayload(model, exam, context, images);
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

export function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

export function parseGradeFromText(text: string): GradeResult {
  const parsed = JSON.parse(extractJsonText(text));
  aiGradeOutputSchema.parse(parsed);
  return gradeResultSchema.parse(parsed);
}

function roundedScore(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function itemKey(item: GradeResult["breakdown"][number]) {
  return `${item.section.trim().toLocaleLowerCase("ro")}:${item.item.trim().toLocaleLowerCase("ro")}`;
}

function normalizedLabel(value: string) {
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function subjectMarker(item: GradeResult["breakdown"][number]) {
  const label = normalizedLabel(`${item.section} ${item.item}`);
  const named = label.match(/subiect(?:ul)?\s+(iii|ii|i)\b/);
  if (named?.[1]) return named[1].toUpperCase() as "I" | "II" | "III";
  const itemPrefix = normalizedLabel(item.item).match(/^(iii|ii|i)(?:\.|\s|-)/);
  return itemPrefix?.[1]?.toUpperCase() as "I" | "II" | "III" | undefined;
}

type PhysicsArea = "A" | "B" | "C" | "D";

function physicsArea(item: GradeResult["breakdown"][number]): PhysicsArea | undefined {
  const section = normalizedLabel(item.section).trim();
  if (/^(?:aria\s+)?a(?:\.|\s|-)|mecanic/.test(section)) return "A";
  if (/^(?:aria\s+)?b(?:\.|\s|-)|termodinamic/.test(section)) return "B";
  if (/^(?:aria\s+)?c(?:\.|\s|-)|curent(?:ul)?\s+continuu|electric/.test(section)) return "C";
  if (/^(?:aria\s+)?d(?:\.|\s|-)|optic/.test(section)) return "D";
  return undefined;
}

function isOlympiadExam(exam?: Pick<Exam, "id" | "platform">): boolean {
  return !!exam?.platform || !!exam?.id.startsWith("olimpiada-") || !!exam?.id.startsWith("olympiad:");
}

function recomputeTotals(
  breakdown: GradeResult["breakdown"],
  isOlympiad: boolean,
  fallback: Pick<GradeResult, "rawPoints" | "totalScore">,
): { rawPoints: number; totalScore: number } {
  const maximum = roundedScore(
    breakdown.reduce((sum, item) => sum + item.maxPoints, 0),
  );
  const awarded = roundedScore(
    breakdown.reduce((sum, item) => sum + item.awardedPoints, 0),
  );
  const canCalculate = isOlympiad
    ? maximum > 0
    : Math.abs(maximum - 100) <= scoreTolerance;
  if (!canCalculate) {
    return { rawPoints: fallback.rawPoints, totalScore: fallback.totalScore };
  }
  const rawPoints = roundedScore(isOlympiad ? (awarded / maximum) * 100 : awarded);
  const totalScore = roundedScore(Math.max(1, Math.min(10, rawPoints / 10)));
  return { rawPoints, totalScore };
}

export function recomputeGradeWithOverrides(
  grade: GradeResult,
  overrides: Record<number, number>,
  isOlympiad: boolean,
): GradeResult {
  const overrideKeys = Object.keys(overrides);
  if (overrideKeys.length === 0) return grade;
  const breakdown = grade.breakdown.map((item, index) => {
    if (!(index in overrides)) return item;
    const override = overrides[index];
    if (override == null || Number.isNaN(override)) return item;
    const clamped = Math.max(
      0,
      Math.min(item.maxPoints, roundedScore(override)),
    );
    return { ...item, awardedPoints: clamped };
  });
  const totals = recomputeTotals(breakdown, isOlympiad, grade);
  return {
    ...grade,
    breakdown,
    rawPoints: totals.rawPoints,
    totalScore: totals.totalScore,
    reviewRequired: false,
    reviewReasons: grade.reviewReasons,
  };
}

export function isOficiuItem(item: GradeResult["breakdown"][number]): boolean {
  const label = `${item.section} ${item.item}`
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /oficiu/.test(label);
}

export function reconcileGradeResult(
  result: GradeResult,
  exam: Exam,
): GradeResult {
  const isOlympiad = isOlympiadExam(exam);
  const maximum = roundedScore(
    result.breakdown.reduce((sum, item) => sum + item.maxPoints, 0),
  );
  const awarded = roundedScore(
    result.breakdown.reduce((sum, item) => sum + item.awardedPoints, 0),
  );
  const reviewReasons = new Set(result.reviewReasons ?? []);
  const seenItems = new Set<string>();
  const officeItems = result.breakdown.filter(isOficiuItem);
  const assessedItems = result.breakdown.filter((item) => !isOficiuItem(item));

  for (const item of result.breakdown) {
    const key = itemKey(item);
    if (seenItems.has(key)) {
      reviewReasons.add(`Itemul ${item.section} ${item.item} apare de mai multe ori.`);
    }
    seenItems.add(key);
    if (item.confidence != null && item.confidence < lowConfidenceThreshold) {
      reviewReasons.add(`Itemul ${item.section} ${item.item} nu a putut fi citit cu suficientă încredere.`);
    }
    if (item.confidence == null) {
      reviewReasons.add(`Itemul ${item.section} ${item.item} nu are un nivel de încredere verificabil.`);
    }
    if (!item.studentEvidence) {
      reviewReasons.add(`Itemul ${item.section} ${item.item} nu indică dovada din lucrare.`);
    }
    if (!item.rubricEvidence) {
      reviewReasons.add(`Itemul ${item.section} ${item.item} nu indică regula aplicată din barem.`);
    }
  }

  if (isOlympiad) {
    if (maximum <= 0) {
      throw new Error("Baremul rezultat nu conține un punctaj maxim valid.");
    }
  } else {
    if (Math.abs(maximum - 100) > scoreTolerance) {
      reviewReasons.add(
        `Corectarea acoperă ${maximum} din 100 de puncte; verifică itemii lipsă.`,
      );
    }
    if (officeItems.length !== 1) {
      reviewReasons.add("Corectarea trebuie să conțină exact un rând pentru cele 10 puncte din oficiu.");
    } else if (
      Math.abs(officeItems[0].maxPoints - 10) > scoreTolerance ||
      Math.abs(officeItems[0].awardedPoints - 10) > scoreTolerance
    ) {
      reviewReasons.add("Punctele din oficiu trebuie să fie 10 din 10.");
    }
    if (assessedItems.length < 4) {
      reviewReasons.add("Corectarea grupează prea multe cerințe și nu oferă o defalcare verificabilă pe itemi.");
    }

    if (exam.subject === "fizica") {
      const areaSubjects = new Map<PhysicsArea, Set<string>>();
      for (const item of assessedItems) {
        const area = physicsArea(item);
        if (!area) continue;
        const subjects = areaSubjects.get(area) ?? new Set<string>();
        const marker = subjectMarker(item);
        if (marker) subjects.add(marker);
        areaSubjects.set(area, subjects);
      }
      if (areaSubjects.size !== 2) {
        reviewReasons.add("La Fizică trebuie evaluate exact două arii tematice identificabile.");
      }
      for (const [area, subjects] of areaSubjects) {
        if (!["I", "II", "III"].every((subject) => subjects.has(subject))) {
          reviewReasons.add(`Aria ${area} nu acoperă distinct Subiectele I, II și III.`);
        }
      }
    } else {
      const subjects = new Set(assessedItems.map(subjectMarker));
      if (!(["I", "II", "III"] as const).every((subject) => subjects.has(subject))) {
        reviewReasons.add("Corectarea nu acoperă distinct Subiectele I, II și III.");
      }
    }
  }

  if (result.unclearWorkWarnings.length > 0) {
    reviewReasons.add("Cel puțin o zonă din lucrare este neclară.");
  }
  for (const note of result.manualReviewNotes) reviewReasons.add(note);
  if (result.confidence < lowConfidenceThreshold) {
    reviewReasons.add("Încrederea generală a corectării este prea mică.");
  }

  const canCalculate = isOlympiad ? maximum > 0 : Math.abs(maximum - 100) <= scoreTolerance;
  const rawPoints = canCalculate
    ? roundedScore(isOlympiad ? (awarded / maximum) * 100 : awarded)
    : result.rawPoints;
  const totalScore = canCalculate
    ? roundedScore(Math.max(1, Math.min(10, rawPoints / 10)))
    : result.totalScore;

  if (canCalculate && Math.abs(result.rawPoints - rawPoints) > scoreTolerance) {
    reviewReasons.add("Totalul declarat de model a fost corectat din punctajele pe itemi.");
  }
  if (canCalculate && Math.abs(result.totalScore - totalScore) > scoreTolerance) {
    reviewReasons.add("Nota declarată de model a fost recalculată determinist.");
  }

  return gradeResultSchema.parse({
    ...result,
    rawPoints,
    totalScore,
    reviewRequired: reviewReasons.size > 0,
    reviewReasons: [...reviewReasons],
  });
}

export function parseAiProviderGradeResponse(
  response: unknown,
  exam?: Exam,
): GradeResult {
  if (!response || typeof response !== "object") {
    throw new Error("Raspuns invalid de la model.");
  }

  const stopReason =
    "stop_reason" in response && typeof response.stop_reason === "string"
      ? response.stop_reason
      : undefined;
  const choicesForFinishReason =
    "choices" in response && Array.isArray(response.choices)
      ? response.choices
      : [];
  const firstChoice = choicesForFinishReason[0];
  const finishReason =
    firstChoice &&
    typeof firstChoice === "object" &&
    "finish_reason" in firstChoice &&
    typeof firstChoice.finish_reason === "string"
      ? firstChoice.finish_reason
      : undefined;
  if (stopReason === "max_tokens" || finishReason === "length") {
    throw new IncompleteGradeResponseError();
  }

  if ("content" in response) {
    const result = parseGradeFromText(contentToText(response.content));
    return exam ? reconcileGradeResult(result, exam) : result;
  }

  const choices = "choices" in response ? response.choices : undefined;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("Raspunsul modelului nu contine choices.");
  }

  const first = choices[0];
  const content =
    first &&
    typeof first === "object" &&
    "message" in first &&
    first.message &&
    typeof first.message === "object" &&
    "content" in first.message
      ? first.message.content
      : undefined;

  const result = parseGradeFromText(contentToText(content));
  return exam ? reconcileGradeResult(result, exam) : result;
}

export async function collectStreamingGradeResponse(
  response: Response,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Raspuns invalid de la model.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let finishReason: string | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice("data:".length).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
          const first = choices[0];
          if (!first || typeof first !== "object") continue;

          const delta =
            "delta" in first && first.delta && typeof first.delta === "object"
              ? first.delta
              : undefined;
          if (delta) {
            if ("content" in delta) {
              fullContent += contentToText(delta.content);
            }
          }

          if (
            "finish_reason" in first &&
            typeof first.finish_reason === "string"
          ) {
            finishReason = first.finish_reason;
          }
        } catch {
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    choices: [
      {
        finish_reason: finishReason,
        message: { content: fullContent },
      },
    ],
  };
}
