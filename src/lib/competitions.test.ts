import { describe, expect, it } from "vitest";
import {
  getOlympiadStage,
  getOlympiadDocumentGrades,
  getOlympiadDocuments,
  getOlympiadWorkspace,
  getOlympiadWorkspaces,
  olympiadCounties,
  olympiadDocuments,
  olympiadExams,
  olympiadGrades,
  olympiadWorkspaces,
  olympiadYears,
  type OlympiadGrade,
} from "@/lib/competitions";
import { olympiadSubjects } from "@/lib/olympiad-subjects";

describe("competition archive", () => {
  it("uses descending years from the mathematics archive", () => {
    expect(olympiadYears).toEqual([...olympiadYears].sort((a, b) => b - a));
    expect(olympiadYears[0]).toBe(2026);
    expect(olympiadYears.at(-1)).toBe(2013);
  });

  it("lists every county and Bucharest alphabetically", () => {
    expect(olympiadCounties).toHaveLength(42);
    expect(olympiadCounties).toEqual(
      [...olympiadCounties].sort(new Intl.Collator("ro").compare),
    );
  });

  it("only resolves supported stages", () => {
    expect(getOlympiadStage("judeteana")?.name).toBe("Județeană");
    expect(getOlympiadStage("necunoscuta")).toBeUndefined();
  });

  it("contains validated documents for every competition stage", () => {
    expect(olympiadDocuments.length).toBeGreaterThan(5_000);
    expect(new Set(olympiadDocuments.map((document) => document.stage))).toEqual(
      new Set(["locala", "judeteana", "nationala"]),
    );
    expect(
      olympiadDocuments.every(
        (document) =>
          document.pdfPath.endsWith(".pdf") && document.sha256.length === 64,
      ),
    ).toBe(true);
  });

  it("integrates every configured olympiad subject", () => {
    const documentSubjects = olympiadSubjects.filter((subject) => subject.mode === "documents");
    const platformSubjects = olympiadSubjects.filter((subject) => subject.mode === "platform");

    expect(documentSubjects.every((subject) =>
      olympiadDocuments.some((document) => document.olympiadSubject === subject.id) &&
      olympiadExams.some((exam) => exam.olympiadSubject === subject.id),
    )).toBe(true);
    expect(platformSubjects.every((subject) =>
      olympiadExams.some((exam) => exam.olympiadSubject === subject.id && exam.platform),
    )).toBe(true);
  });

  it("includes the imported local olympiad history", () => {
    const localYears = new Set(
      olympiadDocuments
        .filter((document) => document.stage === "locala" && document.olympiadSubject === "matematica")
        .map((document) => document.year),
    );
    expect(localYears).toEqual(
      new Set([2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]),
    );
  });

  it("uses common local papers when a county has no specific workspace", () => {
    expect(getOlympiadWorkspaces({
      stage: "locala",
      year: 2021,
      county: "Alba",
      grade: 9,
    })[0]).toMatchObject({
      county: "Alba",
      exam: { title: expect.stringContaining("material comun pentru Alba") },
    });
  });

  it("resolves a subject and barem for every local county/year/grade route", () => {
    const years = [
      ...new Set(
        olympiadDocuments
          .filter((document) => document.stage === "locala" && document.olympiadSubject === "matematica")
          .map((document) => document.year),
      ),
    ];
    const routes = years.flatMap((year) =>
      olympiadCounties.flatMap((county) =>
        ([9, 10, 11, 12] as OlympiadGrade[]).map((grade) => ({ year, county, grade })),
      ),
    );

    expect(routes).toHaveLength(14 * 42 * 4);
    expect(
      routes.every(({ year, county, grade }) => {
        const workspace = getOlympiadWorkspaces({
          stage: "locala",
          year,
          county,
          grade,
        })[0];
        return workspace?.exam.examPdfPath && workspace.exam.baremPdfPath;
      }),
    ).toBe(true);
  });
  it("filters archives to the selected high-school grade", () => {
    const documents = getOlympiadDocuments({
      stage: "nationala",
      year: 2026,
      grade: 9,
    });
    expect(documents).toHaveLength(1);
    expect(documents.every((document) => document.grade === 9)).toBe(true);
    expect(
      getOlympiadDocumentGrades(
        olympiadDocuments.find((document) => document.grade === 5)!,
      ),
    ).toEqual([5]);

    const workspace = getOlympiadWorkspace(documents[0].id, 9);
    expect(workspace?.exam.title).toBe("Națională 2026");
    expect(workspace?.exam.id).toMatch(/^olimpiada-9-/);
    expect(workspace?.exam.examPdfPath).toMatch(/\.pdf$/);
    expect(workspace?.exam.baremPdfPath).toMatch(/\.pdf$/);
  });

  it("includes every olympiad class from V through XII", () => {
    expect(olympiadGrades).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(olympiadWorkspaces.map((workspace) => workspace.grade))).toEqual(
      new Set(olympiadGrades),
    );
  });

  it("infers grades from numeric, Roman numeral, and grouped filenames", () => {
    const document = (title: string) => ({
      ...olympiadDocuments[0],
      grade: undefined,
      title,
    });

    expect(getOlympiadDocumentGrades(document("10-OLM-Barem-V2"))).toEqual([10]);
    expect(getOlympiadDocumentGrades(document("9sb_onm_locala"))).toEqual([9]);
    expect(getOlympiadDocumentGrades(document("12barem_onm"))).toEqual([12]);
    expect(getOlympiadDocumentGrades(document("Clasa a VII-a barem"))).toEqual([7]);
    expect(getOlympiadDocumentGrades(document("Subiecte gimnaziu"))).toEqual([
      5, 6, 7, 8,
    ]);
    expect(getOlympiadDocumentGrades(document("Subiecte 5-12"))).toEqual(
      olympiadGrades,
    );
    expect(getOlympiadDocumentGrades(document("Clasele VII-X"))).toEqual([
      7, 8, 9, 10,
    ]);
  });

  it("pairs local subject and barem abbreviations as separate documents", () => {
    const workspace = olympiadWorkspaces.find(
      (item) =>
        item.grade === 5 &&
        item.year === 2025 &&
        item.county === "Covasna",
    );

    expect(workspace?.subjectDocument.title).toContain("sub RO");
    expect(workspace?.solutionDocument.title).toContain("sol RO");
    expect(workspace?.exam.examPdfPath).not.toBe(workspace?.exam.baremPdfPath);
  });

  it("keeps olympiad names concise and never exposes import paths", () => {
    expect(
      olympiadWorkspaces.every(
        (workspace) =>
          !workspace.exam.title.includes(workspace.exam.profile.split(",")[0]) &&
          !/contents-|clasa-\d|pdf-|source-/i.test(workspace.exam.sessionLabel),
      ),
    ).toBe(true);
  });

  it("does not present an unpaired subject as its own barem", () => {
    const unpairedReuse = olympiadWorkspaces
      .filter(
        (workspace) =>
          workspace.subjectDocument.id === workspace.solutionDocument.id &&
          workspace.subjectDocument.kind !== "combined",
      )
      .map((workspace) => ({
        subject: workspace.olympiadSubject,
        title: workspace.subjectDocument.title,
        barem: workspace.solutionDocument.title,
      }));

    expect(unpairedReuse).toEqual([]);
  });

  it("uses the published German subject-and-barem files, not student papers", () => {
    const germanDocuments = olympiadDocuments.filter(
      (document) => document.olympiadSubject === "limba-germana-moderna",
    );

    expect(germanDocuments).toHaveLength(6);
    expect(germanDocuments.every((document) => document.kind === "combined")).toBe(true);
    expect(germanDocuments.every((document) => /Barem-(?:gimnaziu|liceu)/.test(document.sourceUrl))).toBe(true);
    expect(germanDocuments.every((document) => !/-site\.pdf$/.test(document.sourceUrl))).toBe(true);
  });

  it("only publishes direct CyberEDU competition links", () => {
    const cyberExams = olympiadExams.filter(
      (exam) => exam.olympiadSubject === "securitate-cibernetica",
    );

    expect(cyberExams).toHaveLength(4);
    expect(cyberExams.every((exam) => exam.platform?.url.includes("/competition/"))).toBe(true);
    expect(cyberExams.every((exam) => !exam.platform?.url.endsWith("/trainings"))).toBe(true);
  });
});
