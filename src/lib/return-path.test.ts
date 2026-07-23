import { describe, expect, it } from "vitest";
import { safeReturnPath, withReturnPath } from "./return-path";

describe("archive return paths", () => {
  it("keeps an internal archive path with filters", () => {
    expect(
      safeReturnPath("/matematica?year=2026&session=final", "/matematica"),
    ).toBe("/matematica?year=2026&session=final");
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(safeReturnPath("https://example.com", "/matematica")).toBe(
      "/matematica",
    );
    expect(safeReturnPath("//example.com", "/matematica")).toBe(
      "/matematica",
    );
  });

  it("adds a return path to document links", () => {
    expect(withReturnPath("/exam/example/barem", "/matematica?year=2026")).toBe(
      "/exam/example/barem?from=%2Fmatematica%3Fyear%3D2026",
    );
  });
});
