import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiMessage } from "./ai-message";

describe("AiMessage", () => {
  it("renders markdown lists and latex math", () => {
    render(
      <AiMessage
        content={[
          "**Idee:** folosim formula.",
          "",
          "- Calculeaza $x^2+1$.",
          "- Obtine rezultatul.",
        ].join("\n")}
      />,
    );

    expect(screen.getByText("Idee:")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(document.querySelector(".katex")).toBeTruthy();
  });

  it("renders markdown tables with table markup", () => {
    render(
      <AiMessage
        content={[
          "| Pas | Puncte |",
          "|---|---|",
          "| Ecuația | 3p |",
        ].join("\n")}
      />,
    );

    expect(document.querySelector("table")).toBeTruthy();
    expect(screen.getByText("Ecuația")).toBeInTheDocument();
  });
});
