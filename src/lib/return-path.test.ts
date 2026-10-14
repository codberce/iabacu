import { describe, expect, it } from "vitest";
import { examQueryRedirect, safeReturnPath, withExamContext, withReturnPath } from "./return-path";

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
      "/exam/example/barem#from=%2Fmatematica%3Fyear%3D2026",
    );
  });

  it("keeps private document context outside the HTTP request URL", () => {
    const path = withExamContext("/exam/example", new URLSearchParams({
      from: "/invata/workspace-id", learningWorkspace: "workspace-id", learningActivity: "activity-id",
    }));
    const url = new URL(path, "https://iabacu.ro");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("learningWorkspace")).toBe("workspace-id");
  });

  it("redirects old bookmarks without letting query values enter ISR", () => {
    const url = examQueryRedirect(new URL("https://iabacu.ro/exam/example/barem?from=%2Fmatematica%3Fyear%3D2025&learningActivity=private-id&utm_source=ignored&_rsc=cache-buster"))!;
    expect(url.pathname).toBe("/exam/example/barem");
    expect(url.search).toBe("");
    const context = new URLSearchParams(url.hash.slice(1));
    expect(context.get("from")).toBe("/matematica?year=2025");
    expect(context.get("learningActivity")).toBe("private-id");
    expect(context.has("utm_source")).toBe(false);
    expect(context.has("_rsc")).toBe(false);
  });

  it("sanitizes return paths and drops unknown visitor queries", () => {
    const unsafe = examQueryRedirect(new URL("https://iabacu.ro/exam/example?from=https://example.com"))!;
    expect(new URLSearchParams(unsafe.hash.slice(1)).get("from")).toBe("/");
    expect(examQueryRedirect(new URL("https://iabacu.ro/exam/example?secret=private-id"))!.href).toBe("https://iabacu.ro/exam/example");
  });

  it.each(["/matematica?year=2025", "/api/learning/files/id?token=private", "/exam/example?_rsc=cache-buster", "/exam/example"])("leaves non-document queries and framework requests alone: %s", (path) => {
    expect(examQueryRedirect(new URL(path, "https://iabacu.ro"))).toBeNull();
  });
});
