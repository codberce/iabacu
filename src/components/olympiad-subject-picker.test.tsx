import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { olympiadSubjects } from "@/lib/olympiad-subjects";
import { OlympiadSubjectPicker } from "./olympiad-subject-picker";

afterEach(cleanup);

describe("OlympiadSubjectPicker", () => {
  it("links every documented discipline to its internal archive", () => {
    const { container } = render(<OlympiadSubjectPicker />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(olympiadSubjects.length);
    for (const subject of olympiadSubjects) {
      expect(screen.getByRole("link", { name: subject.name })).toHaveAttribute(
        "href",
        subject.path,
      );
    }
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/olimpiade\//);
      expect(link).not.toHaveAttribute("target");
      expect(link).not.toHaveAttribute("rel");
    }
    expect(container.querySelector(".lg\\:grid-cols-4")).toBeInTheDocument();
    expect(container.querySelector(".lg\\:grid-cols-5")).not.toBeInTheDocument();
  });

  it("keeps source handoffs and explanatory copy out of the selector", () => {
    render(<OlympiadSubjectPicker />);

    expect(screen.queryByText(/sursă oficială/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/arhivă externă/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/te trimitem/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Kilonova")).not.toBeInTheDocument();
    expect(screen.queryByText("MLCompete")).not.toBeInTheDocument();
    expect(screen.queryByText("CyberEDU")).not.toBeInTheDocument();
  });

  it("keeps platform destinations as internal routes with source metadata", () => {
    const platformSubjects = olympiadSubjects.filter(
      (subject) => subject.mode === "platform",
    );

    expect(platformSubjects).toHaveLength(3);
    expect(platformSubjects.map((subject) => subject.platformName)).toEqual([
      "Kilonova",
      "MLCompete",
      "CyberEDU",
    ]);
    expect(
      platformSubjects.every((subject) => subject.platformUrl.startsWith("https://")),
    ).toBe(true);
  });
});
