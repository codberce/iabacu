import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SubjectPicker } from "./subject-picker";

afterEach(cleanup);

describe("SubjectPicker", () => {
  it("opens subject archives without applying filters", () => {
    render(<SubjectPicker />);

    expect(screen.getByRole("link", { name: "Română" })).toHaveAttribute(
      "href",
      "/romana",
    );
    expect(screen.getByRole("link", { name: "Matematică" })).toHaveAttribute(
      "href",
      "/matematica",
    );
    expect(screen.getByRole("link", { name: /Olimpiade/ })).toHaveAttribute(
      "href",
      "/olimpiade",
    );
  });
});
