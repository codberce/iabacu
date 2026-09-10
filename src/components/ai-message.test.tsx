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

  it("renders TeX group notation without exposing delimiters or commands", () => {
    const { container } = render(
      <AiMessage content={String.raw`Grupul \((G,\cdot)\) are elementul neutru \(e\).`} />,
    );

    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.querySelector("annotation")?.textContent).toBe(String.raw`(G,\cdot)`);
    expect(container.querySelector(".katex-html")?.textContent).toContain("⋅");
    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.querySelector("math")).toBeTruthy();
  });

  it("renders display equations inside assistant sections", () => {
    const { container } = render(
      <AiMessage content={String.raw`[PASI]
Aplicăm formula:
\[\frac{-b \pm \sqrt{b^2-4ac}}{2a}\]
Verificăm rezultatul $x^2$.`} />,
    );

    expect(screen.getByText("Pași de rezolvare")).toBeInTheDocument();
    expect(container.querySelectorAll(".katex-display")).toHaveLength(1);
    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.querySelector(".katex-error")).toBeNull();
  });

  it("leaves code examples and ordinary parentheses alone", () => {
    const example = String.raw`\((G,\cdot)\)`;
    const { container } = render(
      <AiMessage content={`(G, operația) și \`${example}\`\n\n\`\`\`tex\n${example}\n\`\`\`\n\n~~~tex\n${example}\n~~~`} />,
    );

    expect(container.querySelectorAll(".katex")).toHaveLength(0);
    expect([...container.querySelectorAll("code")].every((code) => code.textContent?.trim() === example)).toBe(true);
    expect(container).toHaveTextContent("(G, operația)");
  });

  it("renders a formula once its closing delimiter arrives during streaming", () => {
    const { container, rerender } = render(
      <AiMessage content={String.raw`Folosim \(x^2`} />,
    );
    expect(container.querySelector(".katex")).toBeNull();

    rerender(<AiMessage content={String.raw`Folosim \(x^2+1\).`} />);
    expect(container.querySelectorAll(".katex")).toHaveLength(1);
    expect(container.querySelector("annotation")?.textContent).toBe("x^2+1");
  });

});
