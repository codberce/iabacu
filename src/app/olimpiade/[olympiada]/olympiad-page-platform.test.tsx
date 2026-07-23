import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import OlympiadSubjectPage from "./page";

afterEach(cleanup);

const platformGrade9 = { clasa: "9" } as Record<string, string>;
const documentGrade6 = { clasa: "6" } as Record<string, string>;

describe("Olympiad subject page metadata", () => {
  it("routes platform-mode subjects to the paginated archive", async () => {
    render(
      await OlympiadSubjectPage({
        params: Promise.resolve({ olympiada: "olimpiada-de-informatica" }),
        searchParams: Promise.resolve(platformGrade9),
      }),
    );

    expect(screen.getByRole("navigation", { name: "Paginare" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Olimpiade" })).toHaveAttribute(
      "href",
      "/olimpiade",
    );
  });

  it("keeps the document-mode archive for olympiad subjects with PDF documents", async () => {
    render(
      await OlympiadSubjectPage({
        params: Promise.resolve({ olympiada: "olimpiada-de-fizica" }),
        searchParams: Promise.resolve(documentGrade6),
      }),
    );

    expect(screen.getByRole("option", { name: "Toți anii" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Paginare" })).not.toBeInTheDocument();
  });
});
