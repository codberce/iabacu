import { z } from "zod";
import type { DocumentVerificationStatus } from "@/lib/archive-schema";
import type { Exam } from "@/lib/schemas";

export const ZERO_SHA256 = "0".repeat(64);

export type ExamDocumentKind = "subject" | "barem";
export type { DocumentVerificationStatus } from "@/lib/archive-schema";

const verificationLabels: Record<DocumentVerificationStatus, string> = {
  "official-source": "Sursă oficială",
  "verified-copy": "Copie verificată",
  "verification-pending": "Verificare în curs",
};

export function isPlaceholderSha256(value: string | undefined): boolean {
  return !value || value === ZERO_SHA256;
}

function documentSha256(exam: Exam, kind: ExamDocumentKind) {
  return kind === "subject" ? exam.sha256.exam : exam.sha256.barem;
}

function explicitVerificationStatus(
  exam: Exam,
  kind: ExamDocumentKind,
): DocumentVerificationStatus | undefined {
  return kind === "subject"
    ? exam.verification?.subject
    : exam.verification?.barem;
}

export function examDocumentVerificationStatus(
  exam: Exam,
  kind: ExamDocumentKind,
): DocumentVerificationStatus {
  if (isPlaceholderSha256(documentSha256(exam, kind))) {
    return "verification-pending";
  }

  const explicitStatus = explicitVerificationStatus(exam, kind);
  if (explicitStatus) return explicitStatus;

  return exam.sourceKind === "ministry"
    ? "official-source"
    : "verified-copy";
}

export function documentVerificationLabel(
  status: DocumentVerificationStatus,
): string {
  return verificationLabels[status];
}

export function examDocumentVerificationLabel(
  exam: Exam,
  kind: ExamDocumentKind,
): string {
  return documentVerificationLabel(examDocumentVerificationStatus(exam, kind));
}

export const examCapabilitiesSchema = z.object({
  canViewSubject: z.boolean(),
  canViewRubric: z.boolean(),
  canCompare: z.boolean(),
  canUseAiGrading: z.boolean(),
  canUseRubricAssistant: z.boolean(),
});

export type ExamCapabilities = z.infer<typeof examCapabilitiesSchema>;

export type ExamDocumentView = {
  path?: string;
  sha256?: string;
  verificationStatus: DocumentVerificationStatus;
};

export type ExamViewModel = {
  exam: Exam;
  documents: {
    subject?: ExamDocumentView;
    rubric?: ExamDocumentView;
  };
  capabilities: ExamCapabilities;
};

export function capabilitiesForDocuments(documents: {
  subject?: ExamDocumentView;
  rubric?: ExamDocumentView;
}): ExamCapabilities {
  const subjectVerified = Boolean(
    documents.subject &&
      documents.subject.verificationStatus !== "verification-pending",
  );
  const rubricVerified = Boolean(
    documents.rubric &&
      documents.rubric.verificationStatus !== "verification-pending",
  );
  const hasSubject = Boolean(documents.subject?.path);
  const hasRubric = Boolean(documents.rubric?.path);
  const hasDistinctDocuments = Boolean(
    hasSubject &&
      hasRubric &&
      documents.subject?.path !== documents.rubric?.path &&
      documents.subject?.sha256 !== documents.rubric?.sha256,
  );
  const hasVerifiedPair = Boolean(
    subjectVerified && rubricVerified && hasDistinctDocuments,
  );

  return {
    canViewSubject: hasSubject,
    canViewRubric: hasRubric,
    canCompare: hasVerifiedPair,
    canUseAiGrading: hasVerifiedPair,
    canUseRubricAssistant: hasVerifiedPair,
  };
}

export function examViewModel(exam: Exam): ExamViewModel {
  const documents = {
    subject: exam.examPdfPath
      ? {
          path: exam.examPdfPath,
          sha256: exam.sha256.exam,
          verificationStatus: examDocumentVerificationStatus(exam, "subject"),
        }
      : undefined,
    rubric: exam.baremPdfPath
      ? {
          path: exam.baremPdfPath,
          sha256: exam.sha256.barem,
          verificationStatus: examDocumentVerificationStatus(exam, "barem"),
        }
      : undefined,
  };
  return {
    exam,
    documents,
    capabilities: capabilitiesForDocuments(documents),
  };
}

export function capabilitiesForExam(exam: Exam): ExamCapabilities {
  return examViewModel(exam).capabilities;
}
