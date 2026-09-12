import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { ExamSelfAssessment } from "./exam-self-assessment";
import type { Exam } from "@/lib/schemas";
import { loadAttempts } from "@/lib/attempts";
beforeEach(() => { const data = new Map<string, string>(); vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("validates the grade and stores a separate simulation self-assessment without fabricating AI output", () => {
  render(<ExamSelfAssessment exam={{ id: "exam" } as Exam} simulation elapsedSeconds={7200} />);
  fireEvent.click(screen.getByText("Autoevaluare și istoric"));
  fireEvent.change(screen.getByLabelText("Nota ta"), { target: { value: "11" } });
  fireEvent.click(screen.getByText("Salvează nota"));
  expect(screen.getByRole("alert")).toHaveTextContent("între 1 și 10"); expect(loadAttempts()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Nota ta"), { target: { value: "8,25" } });
  fireEvent.click(screen.getByText("Salvează nota"));
  expect(loadAttempts()[0]).toMatchObject({ source: "self", score: 8.25, mode: "simulation", elapsedSeconds: 7200 });
  expect(loadAttempts()[0].gradeResult).toBeUndefined();
  expect(screen.getByRole("status")).toHaveTextContent("salvată");
});
