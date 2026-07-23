import { describe, expect, it } from "vitest";
import {
  bacManifestSchema,
  canonicalExamSchema,
} from "@/lib/archive-schema";
import { canonicalExamToLegacyExam } from "@/lib/archive-adapter";

const sha = (character: string) => character.repeat(64);

const canonical = {
  id: "bac-2026-model",
  type: "bac" as const,
  subject: "matematica" as const,
  year: 2026,
  sessionType: "model" as const,
  sessionLabel: "Model oficial",
  dateLabel: "2026",
  title: "Model oficial 2026",
  profile: "M_mate-info",
  language: "LRO" as const,
  order: 0,
  durationMinutes: 180,
  format: "written" as const,
  contextPath: "src/data/exam-text/bac-2026-model.json",
  documents: {
    subject: {
      primaryCopyId: "subject-copy",
      copies: [
        {
          id: "subject-copy",
          role: "subject" as const,
          assetSha256: sha("a"),
          sourceKind: "ministry" as const,
          sourceUrl: "https://example.com/subject.pdf",
          language: "LRO",
          pdfPath: "/subject.pdf",
          verificationStatus: "official-source" as const,
        },
      ],
    },
    rubric: {
      primaryCopyId: "rubric-copy",
      copies: [
        {
          id: "rubric-copy",
          role: "rubric" as const,
          assetSha256: sha("b"),
          sourceKind: "ministry" as const,
          sourceUrl: "https://example.com/rubric.pdf",
          language: "LRO",
          pdfPath: "/rubric.pdf",
          verificationStatus: "official-source" as const,
        },
      ],
    },
  },
};

describe("canonical archive schema", () => {
  it("validates canonical exams and adapts complete records", () => {
    const parsed = canonicalExamSchema.parse(canonical);
    expect(canonicalExamToLegacyExam(parsed)).toMatchObject({
      id: canonical.id,
      examPdfPath: "/subject.pdf",
      baremPdfPath: "/rubric.pdf",
      sha256: { exam: sha("a"), barem: sha("b") },
    });
  });

  it("keeps incomplete canonical records without fabricating legacy links", () => {
    const parsed = canonicalExamSchema.parse({
      ...canonical,
      documents: { subject: canonical.documents.subject },
    });
    expect(canonicalExamToLegacyExam(parsed)).toBeUndefined();
  });

  it("rejects aliases that omit an auditable decision", () => {
    expect(() =>
      bacManifestSchema.parse({
        version: 1,
        generatedAt: "2026-07-15T00:00:00.000Z",
        assetStorage: "legacy",
        assetBaseUrl: null,
        assets: [],
        exams: [canonical],
        aliases: [
          {
            fromId: "old-id",
            canonicalId: canonical.id,
          },
        ],
      }),
    ).toThrow();
  });
});
