// @vitest-environment node
import { describe, expect, it } from "vitest";
import { olympiadWorkspaces } from "@/lib/competitions";
import { legacyExamRedirect } from "./legacy-exam-redirect";

const workspace = olympiadWorkspaces[0];
const legacyId = `olympiad:${workspace.grade}:${workspace.selectedDocument.id}`;

describe("legacy document redirects", () => {
  it.each(["subject", "barem"] as const)("preserves archive and learning context for a %s", (kind) => {
    const request = new Request("https://www.iabacu.ro/exam/legacy?from=%2Fmatematica%3Fyear%3D2025&learningWorkspace=workspace&learningActivity=activity");
    const response = legacyExamRedirect(request, legacyId, kind);
    expect(response.status).toBe(308);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const destination = new URL(response.headers.get("location")!);
    expect(decodeURIComponent(destination.pathname)).toBe(`/exam/${workspace.exam.id}${kind === "barem" ? "/barem" : ""}`);
    expect(new URLSearchParams(destination.hash.slice(1)).get("from")).toBe("/matematica?year=2025");
    expect(new URLSearchParams(destination.hash.slice(1)).get("learningWorkspace")).toBe("workspace");
    expect(new URLSearchParams(destination.hash.slice(1)).get("learningActivity")).toBe("activity");
  });

  it("sanitizes an unsafe return path", () => {
    const response = legacyExamRedirect(new Request("https://www.iabacu.ro/exam/legacy?from=https%3A%2F%2Fexample.com"), legacyId, "subject");
    expect(new URLSearchParams(new URL(response.headers.get("location")!).hash.slice(1)).get("from")).toBe("/");
  });

  it.each(["olympiad:5:does-not-exist", "arbitrary-id", "olympiad:4:invalid"])("returns 404 for unknown legacy IDs: %s", (id) => {
    expect(legacyExamRedirect(new Request("https://www.iabacu.ro/exam/legacy"), id, "subject").status).toBe(404);
  });
});
