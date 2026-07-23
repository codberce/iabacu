import { describe, expect, it } from "vitest";
import { olympiadExams, getOlympiadWorkspaces } from "@/lib/competitions";
import ExamPage, { generateMetadata } from "./page";

describe("platform exam page metadata", () => {
  it("uses Probă (not Subiect) in the title, description, and keywords for platform exams", async () => {
    const platformExam = olympiadExams.find(
      (exam) => exam.olympiadSubject === "informatica" && exam.platform,
    );
    expect(platformExam?.platform).toBeDefined();

    const metadata = await generateMetadata({
      params: Promise.resolve({ examId: platformExam!.id }),
      searchParams: Promise.resolve({}),
    });

    const title = String(metadata.title ?? "");
    const description = String(metadata.description ?? "");
    const keywords = [
      ...(metadata.keywords as Array<string> | undefined ?? []),
    ];

    expect(title).toMatch(/^Probă Olimpiada de Informatică/);
    expect(title).not.toMatch(/^Subiect Olimpiada de Informatică/);
    expect(description).toMatch(/probă pe Kilonova/);
    expect(description).not.toMatch(/subiect/i);
    expect(keywords.some((keyword) => keyword.startsWith("probă "))).toBe(true);
    expect(keywords.some((keyword) => keyword.startsWith("subiect "))).toBe(false);
  });

  it("keeps Subiect terminology for document olympiad exams", async () => {
    const [documentExam] = getOlympiadWorkspaces({
      olympiadSubject: "fizica",
      grade: 6,
      stage: "nationala",
      year: 2025,
    }).map((workspace) => workspace.exam);
    expect(documentExam?.platform).toBeUndefined();

    const metadata = await generateMetadata({
      params: Promise.resolve({ examId: documentExam!.id }),
      searchParams: Promise.resolve({}),
    });

    const keywords = [
      ...(metadata.keywords as Array<string> | undefined ?? []),
    ];
    const title = String(metadata.title ?? "");
    expect(title).toMatch(/Subiect/);
    expect(keywords.some((keyword) => keyword.startsWith("subiect "))).toBe(true);
    expect(keywords.some((keyword) => keyword.startsWith("probă "))).toBe(false);
  });

  it("renders the platform description using the platform name", async () => {
    const platformExam = olympiadExams.find(
      (exam) => exam.olympiadSubject === "informatica" && exam.platform,
    );
    const element = await ExamPage({
      params: Promise.resolve({ examId: platformExam!.id }),
      searchParams: Promise.resolve({}),
    });
    const html = JSON.stringify(element).replace(/\\u003c/g, "<");
    expect(html).toContain("Kilonova");
    expect(html).not.toContain("platforma sursă");
  });
});
