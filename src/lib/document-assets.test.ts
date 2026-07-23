import { describe, expect, it } from "vitest";
import {
  documentAssetObjectKey,
  documentAssetUrl,
} from "@/lib/document-assets";

const sha256 = "a".repeat(64);

describe("document asset helpers", () => {
  it("uses isolated content-addressed namespaces", () => {
    expect(documentAssetObjectKey("bac", sha256, "pdf")).toBe(
      `bac/pdf/${sha256}.pdf`,
    );
    expect(documentAssetObjectKey("olympiad", sha256, "text")).toBe(
      `olympiad/text/${sha256}.txt`,
    );
  });

  it("normalizes the base URL and preserves legacy fallback paths", () => {
    expect(
      documentAssetUrl({
        namespace: "bac",
        sha256,
        kind: "pdf",
        configuredBaseUrl: "https://assets.example.com///",
        legacyPath: "/legacy.pdf",
      }),
    ).toBe(`https://assets.example.com/bac/pdf/${sha256}.pdf`);
    expect(
      documentAssetUrl({
        namespace: "bac",
        sha256,
        kind: "pdf",
        legacyPath: "/legacy.pdf",
      }),
    ).toBe("/legacy.pdf");
  });

  it("rejects malformed hashes before constructing an object key", () => {
    expect(() => documentAssetObjectKey("bac", "pending", "pdf")).toThrow(
      /Invalid SHA-256/,
    );
  });
});
