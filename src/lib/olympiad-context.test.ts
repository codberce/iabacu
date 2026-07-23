import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOlympiadDocumentGrades,
  getOlympiadWorkspace,
  olympiadDocuments,
} from "@/lib/competitions";
import { loadOlympiadContext } from "@/lib/olympiad-context";

describe("Olympiad workspace context", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pairs a grade-specific subject with a usable grading context", async () => {
    const subjectText = `Olimpiada de Matematică\n${"Subiect demonstrativ. ".repeat(40)}`;
    const baremText = `Barem Olimpiada de Matematică\n${"Soluție demonstrativă. ".repeat(40)}`;
    const fetchMock = vi.fn<(url: string | URL | Request) => Promise<Response>>();
    vi.stubGlobal("fetch", fetchMock);

    const document = olympiadDocuments.find(
      (item) =>
        item.stage === "nationala" &&
        item.year === 2026 &&
        getOlympiadDocumentGrades(item).includes(9),
    );
    expect(document).toBeDefined();

    const workspace = getOlympiadWorkspace(document!.id, 9);
    expect(workspace).toBeDefined();
    const subjectHash = workspace!.subjectDocument.sha256;
    fetchMock.mockImplementation(async (url: string | URL | Request) =>
      new Response(String(url).includes(subjectHash) ? subjectText : baremText),
    );
    const context = await loadOlympiadContext(
      workspace!.exam.id,
      workspace!.subjectDocument,
      workspace!.solutionDocument,
    );

    expect(context.subjectText.length).toBeGreaterThan(500);
    expect(context.baremText.length).toBeGreaterThan(500);
    expect(context.baremText).toMatch(/Olimpiada|Matematic/);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/olympiad\/text\/[a-f0-9]{64}\.txt$/,
      ),
      { cache: "force-cache" },
    );
  });
});
