import { describe, expect, it } from "vitest";
import { normalizeMathDelimiters } from "./normalize-math-delimiters";

describe("normalizeMathDelimiters", () => {
  it.each([
    String.raw`$\text{\(literal\)}$`,
    "$$\nx^2 + 1\n$$",
    String.raw`\\(literal\\)`,
    "```tex\n\\(x^2\\)",
    "~~~tex\n\\[x^2\\]",
    String.raw`Prețul este \$5 și (x + 1).`,
  ])("preserves existing math, escapes, and unfinished code: %s", (content) => {
    expect(normalizeMathDelimiters(content)).toBe(content);
  });

  it("supports line breaks in inline math without making a display block", () => {
    expect(normalizeMathDelimiters("\\(x^2\n + 1\\)")).toBe("$x^2 + 1$");
  });

  it("resumes math conversion after a code block", () => {
    expect(normalizeMathDelimiters("```tex\n\\(x\\)\n```\n\\(y\\)"))
      .toBe("```tex\n\\(x\\)\n```\n$y$");
  });
});
