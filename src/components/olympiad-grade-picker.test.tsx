import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OlympiadGradePicker } from "./olympiad-grade-picker";

afterEach(cleanup);

describe("OlympiadGradePicker", () => {
  it("keeps the subject selector available from the mathematics archive", () => {
    render(<OlympiadGradePicker />);

    expect(screen.getByRole("link", { name: "Olimpiade" })).toHaveAttribute(
      "href",
      "/olimpiade",
    );
  });
});
