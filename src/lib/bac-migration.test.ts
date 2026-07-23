import { describe, expect, it } from "vitest";
import { bacTextObjectKey } from "@/lib/bac-index";
import { getExamById } from "@/lib/exams";
import { ZERO_SHA256 } from "@/lib/document-integrity";
import { bacManifestSchema } from "@/lib/archive-schema";

const { default: rawManifest } = await import("@/data/bac-manifest.json");
const manifest = bacManifestSchema.parse(rawManifest);
const decisions = await import("@/data/bac-canonical-decisions.json");

describe("generated Bac migration data", () => {
  it("keeps every metadata duplicate candidate in an explicit decision record", () => {
    expect(decisions.default.records).toHaveLength(101);
    expect(new Set(decisions.default.records.map((record) => record.localId)).size).toBe(100);
    expect(decisions.default.records.every((record) =>
      ["merge", "distinct", "manual-review"].includes(record.decision),
    )).toBe(true);
    expect(decisions.default.records.every((record) => record.reason)).toBe(true);
  });

  it("does not publish a zero hash as an immutable asset", () => {
    expect(manifest.assets.every((asset) => asset.sha256 !== ZERO_SHA256)).toBe(true);
    expect(manifest.exams.every((exam) =>
      (["subject", "rubric", "combined"] as const)
        .flatMap((key) => exam.documents[key]?.copies ?? [])
        .every((copy) =>
          copy.assetSha256 !== ZERO_SHA256 || copy.verificationStatus === "verification-pending",
        ),
    )).toBe(true);
  });

  it("serves migrated archive records from local paths", () => {
    expect(getExamById("archive-biologie-41")?.examPdfPath).toBe(
      "/archive/41-subject.pdf",
    );
    expect(bacTextObjectKey("archive-biologie-41", "subject")).toBeUndefined();
  });
});
