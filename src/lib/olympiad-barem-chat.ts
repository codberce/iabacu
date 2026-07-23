import type { BaremChatMessage } from "@/lib/barem-chat";
import {
  selectBaremChatContext,
  sectionMarkerInstructions,
} from "@/lib/barem-chat";
import type { ExtractedExamContext } from "@/lib/grading";
import {
  aiChatReasoningOptions,
  type AiEndpointKind,
} from "@/lib/ai-provider";
import type { Exam } from "@/lib/schemas";

const chatMaxTokens = 4096;

function buildOlympiadBaremChatPrompt(
  exam: Exam,
  context: ExtractedExamContext,
  messages: BaremChatMessage[],
) {
  const selectedContext = selectBaremChatContext(context, messages);

  return [
    `Ești un profesor care explică baremul pentru ${exam.profile}.`,
    "Ajuți elevul să înțeleagă soluțiile oficiale, pașii de rezolvare și punctajul.",
    "Nu corecta o lucrare și nu estima o notă. Dacă elevul cere notare, spune-i să folosească fluxul de corectare AI cu pozele lucrării.",
    "Folosește numai contextul oficial de mai jos și explică în română, clar și pe pași.",
    "Dacă fragmentul de context nu acoperă întrebarea, cere elevului numărul exact al problemei în loc să inventezi.",
    "Textul oficial este extras automat din PDF și poate pierde exponenți, indici sau simboluri. Verifică întotdeauna compatibilitatea dintre enunț și soluție înainte să explici o formulă.",
    "Explica rationamentul gradual, fara salturi importante: ideea-cheie, pasii de lucru si verificarea rezultatului fata de baremul oficial.",
    "Adapteaza nivelul la intrebarea elevului si incheie cu o verificare scurta a ideii invatate, nu cu exercitii fara legatura.",
    ...sectionMarkerInstructions,
    "Formatează răspunsul în Markdown curat. Folosește LaTeX pentru matematică: $x^2$ pentru formule inline și $$...$$ pentru formule importante.",
    "Scrie exclusiv în română, fără emoji și fără HTML.",
    "Evită tabelele dacă nu sunt necesare; preferă liste scurte pentru punctaj.",
    "",
    `Variantă: ${exam.title}`,
    `ID: ${exam.id}`,
    ...(selectedContext.grounding?.targetLabel
      ? [`Context selectat: ${selectedContext.grounding.targetLabel}`]
      : []),
    ...(selectedContext.grounding?.subjectPages.length
      ? [`Pagini subiect: ${selectedContext.grounding.subjectPages.join(", ")}`]
      : []),
    ...(selectedContext.grounding?.baremPages.length
      ? [`Pagini soluții: ${selectedContext.grounding.baremPages.join(", ")}`]
      : []),
    "",
    "Text subiect:",
    selectedContext.subjectText,
    "",
    "Text barem și soluții:",
    selectedContext.baremText,
  ].join("\n");
}

export function buildOlympiadBaremChatPayload(
  endpointKind: AiEndpointKind,
  model: string,
  exam: Exam,
  context: ExtractedExamContext,
  messages: BaremChatMessage[],
  options: { stream?: boolean } = {},
) {
  const system = buildOlympiadBaremChatPrompt(
    exam,
    context,
    messages,
  );

  if (endpointKind === "messages") {
    return {
      model,
      temperature: 0.2,
      max_tokens: chatMaxTokens,
      thinking: { type: "disabled" },
      ...(options.stream ? { stream: true } : {}),
      system,
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
      { role: "system", content: system },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
  };
}
