import type { ExtractedExamContext } from "@/lib/grading";
import type { OlympiadDocument } from "@/lib/competitions";
import { olympiadTextUrl } from "@/lib/olympiad-assets";

async function loadExtractedText(document: OlympiadDocument) {
  const response = await fetch(
    document.textPath ?? olympiadTextUrl(document.sha256),
    {
      cache: "force-cache",
    },
  );
  if (!response.ok) {
    throw new Error(`Textul PDF nu este disponibil (${response.status}).`);
  }
  const text = (await response.text()).trim();
  if (!text) throw new Error("PDF-ul nu conține text extractibil.");
  return text;
}

export async function loadOlympiadContext(
  examId: string,
  subject: OlympiadDocument,
  solution: OlympiadDocument,
): Promise<ExtractedExamContext> {
  const subjectText = await loadExtractedText(subject);
  const baremText =
    solution.sha256 === subject.sha256
      ? subjectText
      : await loadExtractedText(solution);
  return { examId, subjectText, baremText };
}
