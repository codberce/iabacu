import rawBacIndex from "@/data/bac-index.json";
import { bacPdfUrl } from "@/lib/bac-assets";
import { documentAssetObjectKey } from "@/lib/document-assets";
import { isPlaceholderSha256, type ExamDocumentKind } from "@/lib/document-integrity";
import { examSchema, type Exam } from "@/lib/schemas";
import { z } from "zod";

export type BacIndexDocumentTuple = [
  id: string,
  assetSha256: string,
  sourceKind: Exam["sourceKind"],
  sourceUrl: string,
  legacyPdfPath: string,
  verificationStatus: NonNullable<Exam["verification"]>["subject"],
  textObjectKey: string | null,
];

export type BacIndexExamTuple = [
  id: string,
  subject: Exam["subject"],
  year: number,
  order: number,
  profile: string,
  language: Exam["language"],
  sessionType: Exam["sessionType"],
  sessionLabel: string,
  dateLabel: string,
  title: string,
  contextPath: Exam["contextPath"],
  durationMinutes: number,
  format: NonNullable<Exam["format"]>,
  subjectDocument: BacIndexDocumentTuple,
  rubricDocument: BacIndexDocumentTuple,
];

type BacIndex = {
  version: 2;
  generatedAt: string;
  assetStorage: "legacy" | "r2";
  assetBaseUrl: string | null;
  aliases: Array<{
    fromId: string;
    canonicalId: string;
    reason: string;
    decidedAt: string;
  }>;
  exams: BacIndexExamTuple[];
};

const index = rawBacIndex as unknown as BacIndex;

function copyPath(copy: BacIndexDocumentTuple) {
  return bacPdfUrl(copy[1], copy[4], index.assetBaseUrl ?? undefined);
}

export const indexedBacExams: Exam[] = z.array(examSchema).parse(
  index.exams.map((tuple) => {
    const [
      id,
      subject,
      year,
      order,
      profile,
      language,
      sessionType,
      sessionLabel,
      dateLabel,
      title,
      contextPath,
      durationMinutes,
      format,
      subjectDocument,
      rubricDocument,
    ] = tuple;
    return {
      id,
      subject,
      year,
      order,
      profile,
      language,
      sessionType,
      sessionLabel,
      dateLabel,
      title,
      contextPath,
      durationMinutes,
      format,
      examPdfPath: copyPath(subjectDocument),
      baremPdfPath: copyPath(rubricDocument),
      sourceKind:
        subjectDocument[2] === "ministry" &&
        rubricDocument[2] === "ministry"
          ? "ministry"
          : "vetted-mirror",
      sourceUrl: subjectDocument[3],
      baremSourceUrl: rubricDocument[3],
      sha256: {
        exam: subjectDocument[1],
        barem: rubricDocument[1],
      },
      verification: {
        subject: subjectDocument[5],
        barem: rubricDocument[5],
      },
    } satisfies Exam;
  }),
);

export const bacArchiveGeneratedAt = index.generatedAt;

export const generatedExamAliases: Readonly<Record<string, string>> =
  Object.fromEntries(
    index.aliases.map((alias) => [alias.fromId, alias.canonicalId]),
  );

/**
 * Returns the immutable object key (e.g. `bac/text/<sha256>.txt`) for the
 * extracted text asset of a Bac exam document, or `undefined` when the exam is
 * still served through the legacy proxy (no verified SHA-256, archive exams).
 * Callers must treat `undefined` as "no immutable text asset; do not scan the
 * legacy proxy path", which is the whole point of the generated archive IDs.
 */
export function bacTextObjectKey(
  examId: string,
  role: ExamDocumentKind,
): string | undefined {
  const exam = indexedBacExams.find((candidate) => candidate.id === examId);
  if (!exam) return undefined;
  const sha256 = role === "subject" ? exam.sha256.exam : exam.sha256.barem;
  if (isPlaceholderSha256(sha256)) return undefined;
  return documentAssetObjectKey("bac", sha256, "text");
}
