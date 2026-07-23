import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExamGrid } from "./exam-grid";
import { saveAttemptRecord } from "@/lib/attempts";
import type { Exam } from "@/lib/schemas";

const exams: Exam[] = [
  {
    id: "bio-anatomie", subject: "biologie", year: 2026, order: 1,
    profile: "Anatomie și Fiziologie", language: "LRO", sessionType: "final",
    sessionLabel: "Sesiunea iunie-iulie", dateLabel: "2 iulie 2026",
    title: "Sesiunea iunie-iulie 2026 · Anatomie și Fiziologie",
    examPdfPath: "/exams/bio-anatomie.pdf", baremPdfPath: "/exams/bio-anatomie-barem.pdf",
    contextPath: "src/data/exam-text/bio-anatomie.json", sourceKind: "ministry",
    sourceUrl: "https://example.com/bio-anatomie.pdf", baremSourceUrl: "https://example.com/bio-anatomie-barem.pdf",
    sha256: { exam: "a".repeat(64), barem: "b".repeat(64) },
  },
  {
    id: "bio-vegetala", subject: "biologie", year: 2026, order: 2,
    profile: "Vegetală și Animală", language: "LRO", sessionType: "final",
    sessionLabel: "Sesiunea iunie-iulie", dateLabel: "2 iulie 2026",
    title: "Sesiunea iunie-iulie 2026 · Vegetală și Animală",
    examPdfPath: "/exams/bio-vegetala.pdf", baremPdfPath: "/exams/bio-vegetala-barem.pdf",
    contextPath: "src/data/exam-text/bio-vegetala.json", sourceKind: "ministry",
    sourceUrl: "https://example.com/bio-vegetala.pdf", baremSourceUrl: "https://example.com/bio-vegetala-barem.pdf",
    sha256: { exam: "c".repeat(64), barem: "d".repeat(64) },
  },
  {
    id: "bio-legacy", subject: "biologie", year: 2025, order: 3,
    profile: "General", language: "LRO", sessionType: "final",
    sessionLabel: "Sesiunea iunie-iulie", dateLabel: "2025",
    title: "Sesiunea iunie-iulie 2025", examPdfPath: "/exams/bio-legacy.pdf",
    baremPdfPath: "/exams/bio-legacy-barem.pdf", contextPath: "src/data/exam-text/bio-legacy.json",
    sourceKind: "vetted-mirror", sourceUrl: "https://example.com/bio-legacy.pdf",
    baremSourceUrl: "https://example.com/bio-legacy-barem.pdf",
    sha256: { exam: "e".repeat(64), barem: "f".repeat(64) },
  },
];

class TestStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: new TestStorage(),
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ExamGrid profile selection", () => {
  it("shows the highest saved score and includes it in progress filters", async () => {
    const result = {
      totalScore: 5.75,
      rawPoints: 57.5,
      confidence: 0.9,
      breakdown: [{
        section: "Subiectul I",
        item: "1",
        maxPoints: 6,
        awardedPoints: 0,
        feedback: "De revăzut.",
      }],
      unclearWorkWarnings: [],
      manualReviewNotes: [],
    };
    saveAttemptRecord({
      id: "lower-attempt",
      examId: "bio-anatomie",
      score: 1,
      createdAt: "2026-07-18T10:00:00.000Z",
      source: "ai",
      gradeResult: { ...result, totalScore: 1, rawPoints: 10 },
    }, window.localStorage);
    saveAttemptRecord({
      id: "highest-attempt",
      examId: "bio-anatomie",
      score: 5.75,
      createdAt: "2026-07-19T10:00:00.000Z",
      source: "ai",
      gradeResult: result,
    }, window.localStorage);

    render(<ExamGrid exams={exams} subject="biologie" />);

    await waitFor(() =>
      expect(document.querySelector('a[href*="bio-anatomie"]')).toHaveTextContent("Max 5.75"),
    );
    const attemptedCard = document.querySelector('a[href*="bio-anatomie"]');
    expect(attemptedCard).toHaveClass("bg-red-100");

    fireEvent.click(screen.getByRole("button", { name: "Filtre" }));
    fireEvent.change(screen.getByLabelText("Progres"), {
      target: { value: "needs-work" },
    });

    expect(document.querySelector('a[href*="bio-anatomie"]')).toBeInTheDocument();
    expect(document.querySelector('a[href*="bio-vegetala"]')).not.toBeInTheDocument();
    expect(screen.getByText("1 rezultat")).toBeInTheDocument();
  });

  it("keeps exam variants in the consolidated filter panel and on cards", () => {
    render(<ExamGrid exams={exams} subject="biologie" />);

    fireEvent.click(screen.getByRole("button", { name: "Filtre" }));
    expect(screen.getByRole("option", { name: "Anatomie și Fiziologie" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "General" })).not.toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getAllByText("Vegetală și Animală").length).toBeGreaterThan(1);
    const legacyCard = document.querySelector('a[href*="bio-legacy"]');
    expect(legacyCard).toHaveTextContent("2025");
    expect(legacyCard).toHaveTextContent("General");
  });

  it("opens on a useful default year without hiding the complete archive", () => {
    render(
      <ExamGrid
        exams={exams}
        subject="biologie"
        defaultYearFilter={2026}
      />,
    );

    expect(screen.getByRole("option", { name: "2026" })).toHaveProperty("selected", true);
    expect(screen.queryByRole("heading", { name: "2025" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Toți anii" })).toBeInTheDocument();
  });
});
