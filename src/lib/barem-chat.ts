import type { Exam } from "@/lib/schemas";
import { z } from "zod";
import type { ExtractedExamContext } from "@/lib/grading";
import {
  aiChatReasoningOptions,
  type AiEndpointKind,
} from "@/lib/ai-provider";

export const baremChatMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().trim().min(1).max(4000),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1).max(20000),
  }),
]);

const maxConversationCharacters = 24000;

export const baremChatRequestSchema = z
  .object({
    examId: z.string().min(1),
    messages: z.array(baremChatMessageSchema).min(1).max(20),
  })
  .refine(
    ({ messages }) =>
      messages.reduce((total, message) => total + message.content.length, 0) <=
      maxConversationCharacters,
    {
      message: "Conversația este prea lungă. Începe o conversație nouă.",
      path: ["messages"],
    },
  )
  .refine(
    ({ messages }) =>
      messages[0]?.role === "user" &&
      messages.at(-1)?.role === "user" &&
      messages.every(
        (message, index) =>
          index === 0 || message.role !== messages[index - 1]?.role,
      ),
    {
      message: "Ordinea mesajelor din conversație este invalidă.",
      path: ["messages"],
    },
  );

export type BaremChatMessage = z.infer<typeof baremChatMessageSchema>;

const pedagogicalInstructions = [
  "Explica rationamentul gradual, fara salturi importante: ideea-cheie, pasii de lucru si verificarea rezultatului fata de baremul oficial.",
  "Adapteaza nivelul la intrebarea elevului si incheie cu o verificare scurta a ideii invatate, nu cu exercitii fara legatura.",
];

export const sectionMarkerInstructions = [
  "Structureaza raspunsul in sectiuni folosind markeri speciali la inceputul fiecarei sectiuni, pe un rand separat:",
  "- [DEFINITIE] pentru definitii, formule sau context teoretic necesar rezolvarii.",
  "- [IDEA] pentru ideea cheie sau abordarea principala a problemei.",
  "- [PASI] pentru pasii de rezolvare numerotati, unul cate unul.",
  "- [VERIFICARE] pentru verificarea rezultatului sau o intrebare scurta de control.",
  "- [ATENTIE] pentru observatii, capcane sau erori frecvente.",
  "- [PUNCTAJ] pentru explicatii despre cum se acorda punctele conform baremului.",
  "Fiecare marker trebuie sa apara la inceputul unui rand, urmat de continutul sectiunii in Markdown.",
  "Nu scrie titluri cu ### sau ####; foloseste doar markerii de mai sus.",
  "Nu este obligatoriu sa folosesti toti markerii; foloseste doar pe cei relevanti pentru intrebarea elevului.",
  "Poti incepe cu un paragraf scurt de introducere inainte de primul marker.",
];

const subjectFallbackLimit = 12000;
const baremFallbackLimit = 18000;
const focusedSectionLimit = 18000;
const focusedItemLimit = 8000;
const chatMaxTokens = 4096;

const notationSafeguards = [
  "Textul oficial este extras automat din PDF si poate pierde exponenti sau indici.",
  "Citeste notatii precum `ln 2 x` ca `ln^2 x = (ln x)^2` atunci cand baremul sau derivata confirma acest lucru; nu le interpreta automat ca `ln(2x)`.",
  "Inainte sa explici o formula, verifica daca enuntul si baremul sunt compatibile matematic. Daca baremul arata derivata `2 ln x / x`, termenul initial este `(ln x)^2`.",
  "Daca elevul te corecteaza, nu repeta interpretarea respinsa; refa citirea dupa contextul oficial si dupa observatia elevului.",
];

type QuestionTarget = {
  subject?: "I" | "II" | "III";
  item?: number;
  letter?: "a" | "b" | "c";
  topic?: "A" | "B" | "C" | "D";
};

const relevantFragmentSeparator = "\n\n--- fragment relevant ---\n\n";
const pageSeparatorPattern = /\n\s*--- page ---\s*\n/g;

function targetFromQuestion(question: string): QuestionTarget {
  const normalized = question.toLocaleLowerCase("ro");
  let subject: QuestionTarget["subject"];
  let topic: QuestionTarget["topic"];

  if (/\b(subiectul|subiect)\s*(i|1)\b/.test(normalized)) {
    subject = "I";
  }
  if (/\b(subiectul|subiect)\s*(ii|2)\b/.test(normalized)) {
    subject = "II";
  }
  if (/\b(subiectul|subiect)\s*(iii|3)\b/.test(normalized)) {
    subject = "III";
  }

  if (/(?:mecanic[ăa]|cinematic[ăa]|dinamic[ăa])/u.test(normalized)) {
    topic = "A";
  }
  if (/(?:termodinamic[ăa]|calorimetr|gaz(?:ul)? ideal)/u.test(normalized)) {
    topic = "B";
  }
  if (
    /(?:curent(?:ul)? (?:electric|continuu)|circuit(?:ul)? electric|electricitate|rezistor|tensiune electric[ăa])/u.test(
      normalized,
    )
  ) {
    topic = "C";
  }
  if (/(?:optic[ăa]|lentil[ăa]|interferen|difrac|oglind[ăa])/u.test(normalized)) {
    topic = "D";
  }

  const labeledItem = normalized.match(
    /\b(?:itemul|exerci[țt]iul|ex\.?|problema|punctul)\s*(?:nr\.?\s*)?(\d{1,2})(?:\s*[.)-]?\s*([abc]))?\b/,
  );
  const compactItem = normalized.match(/\b(\d{1,2})\s*[.)]\s*([abc])\b/);
  const subjectItem = subject
    ? normalized.match(
        /\b(?:subiectul|subiect)\s*(?:i{1,3}|[1-3])\s*[,;:\-]?\s*(\d{1,2})(?:\s*[.)-]?\s*([abc]))?\b/,
      )
    : null;
  const ordinalItem = normalized.match(
    /\b(?:primul|prima)\s+(?:item|exerci[țt]iu|problem[ăa])\b|\b(?:itemul|exerci[țt]iul|problema)\s+(?:primul|prima)\b/,
  );
  const itemMatch = labeledItem ?? compactItem ?? subjectItem;
  const standaloneLetter = normalized.match(
    /\b(?:litera|punctul|subpunctul)\s+([abc])\b/,
  );

  return {
    subject,
    item: itemMatch?.[1]
      ? Number(itemMatch[1])
      : ordinalItem
        ? 1
        : undefined,
    letter: (itemMatch?.[2] ?? standaloneLetter?.[1]) as
      | QuestionTarget["letter"]
      | undefined,
    topic,
  };
}

function hasTarget(target: QuestionTarget) {
  return Boolean(target.subject || target.item || target.letter || target.topic);
}

function targetFromConversation(messages: BaremChatMessage[]): QuestionTarget {
  const userQuestions = messages
    .filter((message) => message.role === "user")
    .map((message) => targetFromQuestion(message.content));
  const latest = userQuestions.at(-1) ?? {};

  if (latest.subject || latest.topic) return latest;

  for (let index = userQuestions.length - 2; index >= 0; index -= 1) {
    const previous = userQuestions[index];
    if (!hasTarget(previous)) continue;

    if (!hasTarget(latest)) return previous;
    return {
      subject: previous.subject,
      item: latest.item ?? previous.item,
      letter: latest.letter ?? (latest.item ? undefined : previous.letter),
      topic: previous.topic,
    };
  }

  return latest;
}

function targetTerms(target: QuestionTarget) {
  const terms: string[] = [];
  if (target.subject === "I") terms.push("SUBIECTUL I");
  if (target.subject === "II") {
    terms.push("SUBIECTUL al II-lea", "SUBIECTUL II");
  }
  if (target.subject === "III") {
    terms.push("SUBIECTUL al III-lea", "SUBIECTUL III");
  }
  if (target.item) {
    terms.push(`${target.item}.`);
    if (target.letter) {
      terms.push(`${target.item}.${target.letter})`, `${target.letter})`);
    }
  }
  if (target.topic === "A") terms.push("A. MECANICĂ");
  if (target.topic === "B") terms.push("B. ELEMENTE DE TERMODINAMICĂ");
  if (target.topic === "C") {
    terms.push("C. PRODUCEREA ȘI UTILIZAREA CURENTULUI CONTINUU");
  }
  if (target.topic === "D") terms.push("D. OPTICĂ");
  return [...new Set(terms)];
}

function regexIndex(text: string, pattern: RegExp, fromIndex = 0) {
  const match = text.slice(fromIndex).match(pattern);
  return match?.index == null ? -1 : fromIndex + match.index;
}

function topicPattern(topic: NonNullable<QuestionTarget["topic"]>) {
  if (topic === "A") {
    return /^[ \t]*A\.\s+MECANIC[ĂA](?!\s*,)/im;
  }
  if (topic === "B") {
    return /^[ \t]*B\.\s+(?:ELEMENTE DE\s+)?TERMODINAMIC[ĂA](?!\s*,)/im;
  }
  if (topic === "C") {
    return /^[ \t]*C\.\s+PRODUCEREA\s+(?:ȘI|SI)\s+UTILIZAREA\s+CURENTULUI\s+CONTINUU\b(?!\s*,)/im;
  }
  return /^[ \t]*D\.\s+OPTIC[ĂA](?!\s*,)/im;
}

function nextTopic(topic: NonNullable<QuestionTarget["topic"]>) {
  if (topic === "A") return "B";
  if (topic === "B") return "C";
  if (topic === "C") return "D";
  return undefined;
}

function extractTopicSection(
  text: string,
  topic: NonNullable<QuestionTarget["topic"]>,
) {
  const start = regexIndex(text, topicPattern(topic));
  if (start === -1) return "";
  const next = nextTopic(topic);
  const end = next ? regexIndex(text, topicPattern(next), start + 1) : -1;
  return text.slice(start, end === -1 ? undefined : end).trim();
}

function physicsSubjectPattern(subject: NonNullable<QuestionTarget["subject"]>) {
  const roman = subject;
  return new RegExp(
    `^[ \\t]*(?:SUBIECTUL(?:\\s+al)?\\s+${roman}(?:-lea)?|${roman}\\.)[ \\t]+`,
    "im",
  );
}

function extractPhysicsSubjectSection(
  text: string,
  subject: NonNullable<QuestionTarget["subject"]>,
) {
  const start = regexIndex(text, physicsSubjectPattern(subject));
  if (start === -1) return "";
  const nextSubject = subject === "I" ? "II" : subject === "II" ? "III" : undefined;
  const end = nextSubject
    ? regexIndex(text, physicsSubjectPattern(nextSubject), start + 1)
    : -1;
  return text.slice(start, end === -1 ? undefined : end).trim();
}

function findFirst(text: string, needles: string[], fromIndex = 0) {
  const lowerText = text.toLowerCase();
  let found = -1;

  for (const needle of needles) {
    const index = lowerText.indexOf(needle.toLowerCase(), fromIndex);
    if (index !== -1 && (found === -1 || index < found)) found = index;
  }

  return found;
}

function subjectHeadingPattern(
  subject: NonNullable<QuestionTarget["subject"]>,
) {
  if (subject === "I") return /SUBIECTUL\s+I\b/i;
  return new RegExp(
    `SUBIECTUL\\s+(?:al\\s+)?${subject}\\s*(?:-\\s*lea)?\\b`,
    "i",
  );
}

function extractSubjectSection(text: string, subject: QuestionTarget["subject"]) {
  if (!subject) return "";
  const start = regexIndex(text, subjectHeadingPattern(subject));
  if (start === -1) return "";

  const nextSubject = subject === "I" ? "II" : subject === "II" ? "III" : undefined;
  const next = nextSubject
    ? regexIndex(text, subjectHeadingPattern(nextSubject), start + 1)
    : -1;
  return text.slice(start, next === -1 ? undefined : next).trim();
}

function itemNeedles(item: number, letter?: QuestionTarget["letter"]) {
  if (letter) return [`${item}.${letter})`, `${item}.${letter}`, `${letter})`];
  return [`${item}.`];
}

function nextItemNeedles(item: number, letter?: QuestionTarget["letter"]) {
  if (letter) {
    const nextLetter = letter === "a" ? "b" : letter === "b" ? "c" : undefined;
    return [
      ...(nextLetter ? [`${item}.${nextLetter})`, `${nextLetter})`] : []),
      `${item + 1}.`,
    ];
  }

  return [`${item + 1}.`];
}

function extractItemSection(section: string, item: number, letter?: QuestionTarget["letter"]) {
  const start = findFirst(section, itemNeedles(item, letter));
  if (start === -1) return "";

  const next = findFirst(section, nextItemNeedles(item, letter), start + 1);
  return section.slice(start, next === -1 ? undefined : next).trim();
}

function extractFocusedText(
  text: string,
  target: QuestionTarget,
  fallbackLimit: number,
) {
  if (target.topic) {
    const topicSection = extractTopicSection(text, target.topic);
    if (topicSection) {
      const subjectSection = target.subject
        ? extractPhysicsSubjectSection(topicSection, target.subject)
        : "";
      const scope = subjectSection || topicSection;
      if (target.item) {
        const item = extractItemSection(scope, target.item, target.letter);
        if (item) return item.slice(0, focusedItemLimit);
      }
      return scope.slice(0, focusedSectionLimit);
    }
  }

  if (target.subject) {
    const section = extractSubjectSection(text, target.subject);
    if (section && target.item) {
      const item = extractItemSection(section, target.item, target.letter);
      if (item) return item.slice(0, focusedItemLimit);
    }
    if (section) return section.slice(0, focusedSectionLimit);
  }

  return extractSnippets(text, targetTerms(target), fallbackLimit);
}

function extractSnippets(text: string, terms: string[], fallbackLimit: number) {
  const lowerText = text.toLowerCase();
  const snippets: string[] = [];

  for (const term of terms) {
    const index = lowerText.indexOf(term.toLowerCase());
    if (index === -1) continue;

    const start = Math.max(0, index - 1800);
    const end = Math.min(text.length, index + 6200);
    snippets.push(text.slice(start, end).trim());
  }

  if (snippets.length === 0) return text.slice(0, fallbackLimit);

  return snippets
    .filter((snippet, index) => snippets.indexOf(snippet) === index)
    .join(relevantFragmentSeparator)
    .slice(0, fallbackLimit);
}

function selectedPageNumbers(text: string, selectedText: string) {
  const pages = text.split(pageSeparatorPattern).filter((page) => page.trim());
  const fragments = selectedText
    .split(relevantFragmentSeparator)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  const selectedPages = new Set<number>();

  for (const fragment of fragments) {
    const marker = fragment.slice(0, Math.min(240, fragment.length));
    const pageIndex = pages.findIndex((page) => page.includes(marker));
    if (pageIndex !== -1) selectedPages.add(pageIndex + 1);
  }

  return [...selectedPages];
}

function targetLabel(target: QuestionTarget) {
  const parts: string[] = [];
  if (target.topic) parts.push(`aria ${target.topic}`);
  if (target.subject) parts.push(`Subiectul ${target.subject}`);
  if (target.item) {
    parts.push(`itemul ${target.item}${target.letter ? `.${target.letter}` : ""}`);
  } else if (target.letter) {
    parts.push(`punctul ${target.letter}`);
  }
  return parts.join(", ") || undefined;
}

export function normalizeExtractedMathText(text: string) {
  return text
    .replace(/\bln\s+2\s*x\b/g, "ln^2 x")
    .replace(/\be\s+x\b/g, "e^x");
}

export function selectBaremChatContext(
  context: ExtractedExamContext,
  messages: BaremChatMessage[],
): ExtractedExamContext {
  const target = targetFromConversation(messages);
  const subjectText = extractFocusedText(
    context.subjectText,
    target,
    subjectFallbackLimit,
  );
  const baremText = extractFocusedText(
    context.baremText,
    target,
    baremFallbackLimit,
  );

  return {
    examId: context.examId,
    subjectText: normalizeExtractedMathText(subjectText),
    baremText: normalizeExtractedMathText(baremText),
    grounding: {
      targetLabel: targetLabel(target),
      subjectPages: selectedPageNumbers(context.subjectText, subjectText),
      baremPages: selectedPageNumbers(context.baremText, baremText),
    },
  };
}

export function baremChatGroundingHeaders(
  context: ExtractedExamContext,
  messages: BaremChatMessage[],
) {
  const grounding = selectBaremChatContext(context, messages).grounding;
  if (!grounding) return {};
  return {
    ...(grounding.targetLabel
      ? { "x-ai-context-target": encodeURIComponent(grounding.targetLabel) }
      : {}),
    "x-ai-context-subject-pages": grounding.subjectPages.join(","),
    "x-ai-context-barem-pages": grounding.baremPages.join(","),
  };
}

export type BaremCitation = {
  page: number;
  texts: string[];
};

/**
 * Returns the exact barem fragments injected into the prompt, grouped by the
 * PDF page they come from. The client uses these to scroll to and highlight
 * the cited passages. Fragments intentionally skip the math-text
 * normalization applied to the prompt so they still match the raw PDF text.
 */
export function baremChatCitations(
  context: ExtractedExamContext,
  messages: BaremChatMessage[],
): BaremCitation[] {
  const target = targetFromConversation(messages);
  const selectedBaremText = extractFocusedText(
    context.baremText,
    target,
    baremFallbackLimit,
  );

  const contextPages = context.baremText
    .split(pageSeparatorPattern)
    .filter((page) => page.trim());
  if (contextPages.length === 0 || !selectedBaremText.trim()) return [];

  const byPage = new Map<number, string[]>();
  const fragments = selectedBaremText
    .split(relevantFragmentSeparator)
    .map((fragment) => fragment.trim())
    .filter(Boolean);

  for (const fragment of fragments) {
    const pieces = fragment
      .split(pageSeparatorPattern)
      .map((piece) => piece.trim())
      .filter(Boolean);
    for (const piece of pieces) {
      const marker = piece.slice(0, 240);
      const pageIndex = contextPages.findIndex((page) =>
        page.includes(marker),
      );
      if (pageIndex === -1) continue;
      const texts = byPage.get(pageIndex + 1) ?? [];
      if (!texts.includes(piece)) texts.push(piece);
      byPage.set(pageIndex + 1, texts);
    }
  }

  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, texts]) => ({ page, texts }));
}

export function buildBaremChatPrompt(
  exam: Exam,
  context: ExtractedExamContext,
  messages: BaremChatMessage[] = [],
): string {
  const selectedContext = selectBaremChatContext(context, messages);
  const subjectNames: Record<Exam["subject"], string> = {
    romana: "limba și literatura română",
    matematica: "matematică",
    istorie: "istorie",
    biologie: "biologie",
    chimie: "chimie",
    fizica: "fizică",
    geografie: "geografie",
    informatica: "informatică",
    logica: "logică și argumentare",
    psihologie: "psihologie",
    sociologie: "sociologie",
    economie: "economie",
    filosofie: "filosofie",
  };

  return [
    `Esti un profesor de ${subjectNames[exam.subject]} pentru Bacalaureat (${exam.profile}).`,
    "Ajuti elevul sa inteleaga baremul oficial, pasii de rezolvare si punctajul.",
    "Nu corecta o lucrare si nu estima o nota. Daca elevul cere notare, spune-i sa foloseasca fluxul de corectare AI cu pozele lucrarii.",
    "Foloseste numai contextul oficial de mai jos si explica in romana, clar si pe pasi.",
    "Daca fragmentul de context nu acopera intrebarea, cere elevului subiectul si itemul exact in loc sa inventezi.",
    ...(exam.subject === "matematica" ? notationSafeguards : []),
    ...pedagogicalInstructions,
    ...sectionMarkerInstructions,
    "Formateaza raspunsul in Markdown curat. Foloseste LaTeX pentru matematica: $x^2$ pentru formule inline si $$...$$ pentru formule importante.",
    "Scrie exclusiv in romana, fara emoji, fara caractere straine si fara HTML.",
    "Evita tabelele daca nu sunt necesare; prefera liste scurte pentru punctaj.",
    "",
    `Examen: ${exam.title}`,
    `ID: ${exam.id}`,
    ...(selectedContext.grounding?.targetLabel
      ? [`Context selectat: ${selectedContext.grounding.targetLabel}`]
      : []),
    ...(selectedContext.grounding?.subjectPages.length
      ? [`Pagini subiect: ${selectedContext.grounding.subjectPages.join(", ")}`]
      : []),
    ...(selectedContext.grounding?.baremPages.length
      ? [`Pagini barem: ${selectedContext.grounding.baremPages.join(", ")}`]
      : []),
    "",
    "Text subiect:",
    selectedContext.subjectText,
    "",
    "Text barem:",
    selectedContext.baremText,
  ].join("\n");
}

type BaremChatPayloadOptions = {
  stream?: boolean;
};

export function buildBaremChatPayload(
  endpointKind: AiEndpointKind,
  model: string,
  exam: Exam,
  context: ExtractedExamContext,
  messages: BaremChatMessage[],
  options: BaremChatPayloadOptions = {},
) {
  if (endpointKind === "messages") {
    return {
      model,
      temperature: 0.2,
      max_tokens: chatMaxTokens,
      thinking: { type: "disabled" },
      ...(options.stream ? { stream: true } : {}),
      system: buildBaremChatPrompt(
        exam,
        context,
        messages,
      ),
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    };
  }

  return {
    model,
    temperature: 0.2,
    max_tokens: chatMaxTokens,
    ...aiChatReasoningOptions(model),
    ...(options.stream ? { stream: true } : {}),
    messages: [
      {
        role: "system",
        content: buildBaremChatPrompt(
          exam,
          context,
          messages,
        ),
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
  };
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

export function parseAiChatErrorMessage(content: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(content.trim());
    if (
      parsed &&
      typeof parsed === "object" &&
      "type" in parsed &&
      parsed.type === "error" &&
      "error" in parsed &&
      typeof parsed.error === "string" &&
      parsed.error.trim()
    ) {
      return parsed.error.trim();
    }
  } catch {
    // A normal prose response is not JSON.
  }
  return undefined;
}

export function parseAiChatMessage(response: unknown): string {
  if (!response || typeof response !== "object") {
    throw new Error("Raspuns invalid de la model.");
  }

  if ("content" in response) {
    const message = contentToText(response.content).trim();
    if (!message) throw new Error("Modelul a returnat un mesaj gol.");
    const error = parseAiChatErrorMessage(message);
    if (error) throw new Error(error);
    return message;
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

  const text = contentToText(content).trim();
  if (!text) throw new Error("Modelul a returnat un mesaj gol.");
  const error = parseAiChatErrorMessage(text);
  if (error) throw new Error(error);
  return text;
}

export function parseAiChatDelta(event: unknown): string {
  if (!event || typeof event !== "object") return "";

  if (
    "type" in event &&
    typeof event.type === "string" &&
    (event.type === "thinking" ||
      event.type === "signature_delta" ||
      event.type.startsWith("thinking"))
  ) {
    return "";
  }

  if (
    "content_block" in event &&
    event.content_block &&
    typeof event.content_block === "object" &&
    "type" in event.content_block &&
    typeof event.content_block.type === "string" &&
    event.content_block.type === "thinking"
  ) {
    return "";
  }

  if ("delta" in event && event.delta && typeof event.delta === "object") {
    const delta = event.delta;
    if ("type" in delta && typeof delta.type === "string" && delta.type === "thinking_delta") {
      return "";
    }
    if ("text" in delta && typeof delta.text === "string") return delta.text;
    if ("content" in delta) return contentToText(delta.content);
  }

  if (
    "content_block" in event &&
    event.content_block &&
    typeof event.content_block === "object" &&
    "text" in event.content_block &&
    typeof event.content_block.text === "string"
  ) {
    return event.content_block.text;
  }

  const choices = "choices" in event ? event.choices : undefined;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    if (!first || typeof first !== "object") return "";
    if ("delta" in first && first.delta && typeof first.delta === "object") {
      const delta = first.delta;
      if ("content" in delta) return contentToText(delta.content);
    }
  }

  return "";
}
