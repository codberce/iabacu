import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import OlympiadSubjectPage from "./[olympiada]/page";
import MathematicsOlympiadPage from "./olimpiada-de-matematica/page";

afterEach(cleanup);

describe("Olympiad archive year filter", () => {
  it("defaults document subject archives to all years", async () => {
    render(
      await OlympiadSubjectPage({
        params: Promise.resolve({ olympiada: "olimpiada-de-fizica" }),
        searchParams: Promise.resolve({ clasa: "6" }),
      }),
    );

    expect(screen.getByRole("option", { name: "Toți anii" })).toHaveProperty(
      "selected",
      true,
    );
  });

  it("defaults the mathematics archive to all years", async () => {
    render(
      await MathematicsOlympiadPage({
        searchParams: Promise.resolve({ clasa: "5" }),
      }),
    );

    expect(screen.getByRole("option", { name: "Toți anii" })).toHaveProperty(
      "selected",
      true,
    );
  });
});
