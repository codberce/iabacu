import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamRouteWorkspace, BaremRouteWorkspace } from "./exam-route-workspace";
import type { Exam } from "@/lib/schemas";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: query }));
vi.mock("@/components/exam-workspace", () => ({
  ExamWorkspace: (props: unknown) => <output data-testid="subject">{JSON.stringify(props)}</output>,
}));
vi.mock("@/components/barem-workspace", () => ({
  BaremWorkspace: (props: unknown) => <output data-testid="barem">{JSON.stringify(props)}</output>,
}));

const exam = { id: "model-2026", subject: "matematica" } as Exam;
afterEach(cleanup);

async function props(kind: "subject" | "barem") {
  await waitFor(() => expect(screen.getByTestId(kind)).toBeInTheDocument());
  return JSON.parse(screen.getByTestId(kind).textContent!);
}

describe("cached exam navigation", () => {
  it("reads return links from the current URL", async () => {
    query.mockReturnValue(new URLSearchParams({
      from: "/matematica?year=2025&session=final",
    }));
    render(<ExamRouteWorkspace exam={exam} collectionPath="/matematica" />);
    expect(await props("subject")).toMatchObject({
      backHref: "/matematica?year=2025&session=final",
      baremHref: "/exam/model-2026/barem?from=%2Fmatematica%3Fyear%3D2025%26session%3Dfinal",
    });
  });

  it("updates barem navigation when query context changes without mixing visitors", async () => {
    query.mockReturnValue(new URLSearchParams({ from: "/matematica?year=2025" }));
    const view = render(<BaremRouteWorkspace exam={exam} collectionPath="/matematica" />);
    expect((await props("barem")).backHref).toBe("/matematica?year=2025");

    query.mockReturnValue(new URLSearchParams({ from: "/matematica?year=2026" }));
    view.rerender(<BaremRouteWorkspace exam={exam} collectionPath="/matematica" />);
    expect(await props("barem")).toMatchObject({
      backHref: "/matematica?year=2026",
      subjectHref: "/exam/model-2026?from=%2Fmatematica%3Fyear%3D2026",
    });
  });

  it.each(["//example.com", "https://example.com", "/\\example.com"])(
    "rejects unsafe return destinations: %s", async (from) => {
      query.mockReturnValue(new URLSearchParams({ from }));
      render(<ExamRouteWorkspace exam={exam} collectionPath="/matematica" />);
      expect(await props("subject")).toMatchObject({ backHref: "/matematica" });
    },
  );
});
