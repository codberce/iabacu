import { describe, expect, it } from "vitest";
import {
  capabilitiesForDocuments,
  capabilitiesForExam,
  documentVerificationLabel,
  examDocumentVerificationStatus,
  isPlaceholderSha256,
  ZERO_SHA256,
} from "@/lib/document-integrity";
import type { Exam } from "@/lib/schemas";

const exam: Exam = {
  id: "archive-matematica-1",
  subject: "matematica",
  year: 2024,
  order: 0,
  profile: "M1",
  language: "LRO",
  sessionType: "final",
  sessionLabel: "Sesiunea iunie/iulie",
  dateLabel: "2024",
  title: "Matematică 2024",
  examPdfPath: "/subject.pdf",
  baremPdfPath: "/barem.pdf",
  contextPath: "src/data/exam-text/archive/archive-matematica-1.json",
  sourceKind: "vetted-mirror",
  sourceUrl: "https://example.com/subject",
  baremSourceUrl: "https://example.com/barem",
  sha256: { exam: "a".repeat(64), barem: "b".repeat(64) },
};

describe("document integrity", () => {
  it("treats the legacy all-zero digest as pending verification", () => {
    const pending = {
      ...exam,
      sha256: { ...exam.sha256, exam: ZERO_SHA256 },
    };

    expect(isPlaceholderSha256(pending.sha256.exam)).toBe(true);
    expect(examDocumentVerificationStatus(pending, "subject")).toBe(
      "verification-pending",
    );
    expect(capabilitiesForExam(pending).canUseAiGrading).toBe(false);
  });

  it("distinguishes official sources, verified copies, and explicit pending states", () => {
    expect(examDocumentVerificationStatus(exam, "subject")).toBe(
      "verified-copy",
    );
    expect(
      examDocumentVerificationStatus(
        { ...exam, sourceKind: "ministry" },
        "subject",
      ),
    ).toBe("official-source");
    expect(
      examDocumentVerificationStatus(
        {
          ...exam,
          verification: {
            subject: "verification-pending",
            barem: "verified-copy",
          },
        },
        "subject",
      ),
    ).toBe("verification-pending");
    expect(documentVerificationLabel("verified-copy")).toBe(
      "Copie verificată",
    );
  });

  it("derives honest capabilities when canonical documents are absent", () => {
    expect(capabilitiesForDocuments({})).toEqual({
      canViewSubject: false,
      canViewRubric: false,
      canCompare: false,
      canUseAiGrading: false,
      canUseRubricAssistant: false,
    });
    expect(
      capabilitiesForDocuments({
        subject: {
          path: "/subject.pdf",
          sha256: "a".repeat(64),
          verificationStatus: "official-source",
        },
      }),
    ).toMatchObject({
      canViewSubject: true,
      canViewRubric: false,
      canCompare: false,
      canUseAiGrading: false,
    });
  });

  it("requires two distinct verified documents for AI capabilities", () => {
    expect(capabilitiesForExam(exam)).toMatchObject({
      canCompare: true,
      canUseAiGrading: true,
      canUseRubricAssistant: true,
    });

    const reused = {
      ...exam,
      baremPdfPath: exam.examPdfPath,
      sha256: { exam: "a".repeat(64), barem: "a".repeat(64) },
    };
    expect(capabilitiesForExam(reused)).toMatchObject({
      canCompare: false,
      canUseAiGrading: false,
      canUseRubricAssistant: false,
    });
  });
});
