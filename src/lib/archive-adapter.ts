import type {
  CanonicalExam,
  DocumentCopy,
  DocumentSet,
} from "@/lib/archive-schema";
import type { Exam } from "@/lib/schemas";

function primaryCopy(
  documents: DocumentSet,
  role: "subject" | "rubric",
): DocumentCopy | undefined {
  const reference = documents[role];
  if (!reference) return;
  return (
    reference.copies.find((copy) => copy.id === reference.primaryCopyId) ??
    reference.copies[0]
  );
}

export function canonicalExamToLegacyExam(exam: CanonicalExam): Exam | undefined {
  const subject = primaryCopy(exam.documents, "subject");
  const rubric = primaryCopy(exam.documents, "rubric");
  if (!subject?.pdfPath || !rubric?.pdfPath || !exam.contextPath) return;

  return {
    id: exam.id,
    subject: exam.subject,
    year: exam.year,
    order: exam.order,
    profile: exam.profile,
    language: exam.language,
    sessionType: exam.sessionType,
    sessionLabel: exam.sessionLabel,
    dateLabel: exam.dateLabel,
    title: exam.title,
    examPdfPath: subject.pdfPath,
    baremPdfPath: rubric.pdfPath,
    contextPath: exam.contextPath as Exam["contextPath"],
    sourceKind:
      subject.sourceKind === "ministry" && rubric.sourceKind === "ministry"
        ? "ministry"
        : "vetted-mirror",
    sourceUrl: subject.sourceUrl,
    baremSourceUrl: rubric.sourceUrl,
    sha256: {
      exam: subject.assetSha256,
      barem: rubric.assetSha256,
    },
    verification: {
      subject: subject.verificationStatus,
      barem: rubric.verificationStatus,
    },
    ...(exam.durationMinutes
      ? { durationMinutes: exam.durationMinutes }
      : {}),
    ...(exam.format ? { format: exam.format } : {}),
  };
}
