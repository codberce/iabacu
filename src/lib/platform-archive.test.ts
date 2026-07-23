import { describe, expect, it } from "vitest";
import {
  getPlatformArchive,
  getPlatformArchiveExams,
  olympiadExams,
  PLATFORM_ARCHIVE_PAGE_SIZE,
  platformArchivePath,
} from "@/lib/competitions";

const INFORMATICA = "informatica";
const grade9 = 9 as const;

describe("platform archive helpers", () => {
  it("caps the per-page response at the configured page size", () => {
    const archive = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
    });
    expect(archive.pageSize).toBe(PLATFORM_ARCHIVE_PAGE_SIZE);
    expect(archive.exams.length).toBeLessThanOrEqual(PLATFORM_ARCHIVE_PAGE_SIZE);
    const totalForGrade9 = olympiadExams.filter(
      (exam) =>
        exam.olympiadSubject === INFORMATICA &&
        exam.profile.endsWith(`clasa a ${grade9}-a`),
    ).length;
    expect(totalForGrade9).toBeGreaterThan(PLATFORM_ARCHIVE_PAGE_SIZE);
    expect(archive.total).toBe(totalForGrade9);
    expect(archive.totalPages).toBeGreaterThan(1);
    expect(archive.hasNext).toBe(true);
    expect(archive.hasPrevious).toBe(false);
  });

  it("sorts the page in descending year and respects absolute positions", () => {
    const archive = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
    });
    const years = archive.exams.map((exam) => exam.year);
    const sorted = [...years].sort((a, b) => b - a);
    expect(years).toEqual(sorted);
    expect(archive.startIndex).toBe(1);
    expect(archive.endIndex).toBe(archive.exams.length);
  });

  it("ignores malformed stage and year values", () => {
    const baseline = getPlatformArchive({ olympiadSubject: INFORMATICA, grade: grade9 });
    const filtered = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      stage: "necunoscuta",
      year: "9999",
    });
    expect(filtered.total).toBe(baseline.total);
    expect(filtered.filters.stage).toBe("all");
    expect(filtered.filters.year).toBe("all");
  });

  it("filters by year and stage and resets the page", () => {
    const onlyJudeteana = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      stage: "judeteana",
    });
    const onlyNationala = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      stage: "nationala",
    });
    expect(onlyJudeteana.total).toBeGreaterThan(0);
    expect(onlyNationala.total).toBeGreaterThan(0);
    expect(
      onlyJudeteana.exams.every((exam) => exam.sessionType === "simulation"),
    ).toBe(true);
    expect(
      onlyNationala.exams.every((exam) => exam.sessionType === "final"),
    ).toBe(true);

    const only2026 = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      year: "2026",
    });
    expect(only2026.exams.every((exam) => exam.year === 2026)).toBe(true);
    expect(only2026.total).toBeLessThan(
      getPlatformArchive({ olympiadSubject: INFORMATICA, grade: grade9 }).total,
    );
  });

  it("clamps the requested page to the available range", () => {
    const archive = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      page: "9999",
    });
    expect(archive.page).toBe(archive.totalPages);
    expect(archive.hasNext).toBe(false);
    const zeroPage = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      page: "0",
    });
    expect(zeroPage.page).toBe(1);
    const negativePage = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      page: "-3",
    });
    expect(negativePage.page).toBe(1);
  });

  it("applies a search query across titles, years, and ids", () => {
    const baseline = getPlatformArchive({ olympiadSubject: INFORMATICA, grade: grade9 });
    const firstExam = baseline.exams[0];
    const search = getPlatformArchive({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      q: String(firstExam.year),
    });
    expect(search.total).toBeGreaterThan(0);
    expect(search.total).toBeLessThan(baseline.total);
    expect(
      search.exams.every((exam) => exam.year === firstExam.year),
    ).toBe(true);
    expect(getPlatformArchiveExams({ olympiadSubject: INFORMATICA, grade: grade9, stage: "all", year: "all", q: "" }).length).toBe(baseline.total);
  });

  it("emits deterministic page paths for the platform archive", () => {
    const base = platformArchivePath({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      stage: "all",
      year: "all",
      q: "",
      page: 1,
    });
    expect(base).toBe("/olimpiade/olimpiada-de-informatica?clasa=9");
    const filtered = platformArchivePath({
      olympiadSubject: INFORMATICA,
      grade: grade9,
      stage: "judeteana",
      year: 2024,
      q: "kilonova",
      page: 2,
    });
    expect(filtered).toContain("clasa=9");
    expect(filtered).toContain("etapa=judeteana");
    expect(filtered).toContain("an=2024");
    expect(filtered).toContain("q=kilonova");
    expect(filtered).toContain("pagina=2");
  });
});
