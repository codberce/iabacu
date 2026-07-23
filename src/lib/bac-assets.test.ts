import { afterEach, describe, expect, it, vi } from "vitest";
import { bacPdfUrl } from "@/lib/bac-assets";
import { ZERO_SHA256 } from "@/lib/document-integrity";

const sha256 = "a".repeat(64);

describe("Bac asset URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves pending legacy routes until they have immutable assets", () => {
    vi.stubEnv("NEXT_PUBLIC_BAC_ASSET_BASE_URL", "https://assets.example.com");
    expect(bacPdfUrl(ZERO_SHA256, "/api/archive-pdf/41/subject.pdf")).toBe(
      "/api/archive-pdf/41/subject.pdf",
    );
  });

  it("uses immutable Bac namespaces for verified assets", () => {
    vi.stubEnv("NEXT_PUBLIC_BAC_ASSET_BASE_URL", "https://assets.example.com");
    expect(bacPdfUrl(sha256, "/legacy.pdf")).toBe(
      `https://assets.example.com/bac/pdf/${sha256}.pdf`,
    );
  });
});
