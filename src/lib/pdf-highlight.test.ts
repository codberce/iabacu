import { describe, expect, it } from "vitest";
import {
  findCitedTextRange,
  normalizeForMatch,
} from "./pdf-highlight";

function containerWith(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("normalizeForMatch", () => {
  it("folds diacritics, case, whitespace and punctuation", () => {
    expect(normalizeForMatch("Într-un triunghi ABC,")).toBe(
      "intruntriunghiabc",
    );
  });

  it("unifies Romanian cedilla and comma-below variants", () => {
    expect(normalizeForMatch("şi ţară")).toBe(normalizeForMatch("și țară"));
  });

  it("treats math notation variants as equal", () => {
    expect(normalizeForMatch("ln^2 x")).toBe(normalizeForMatch("ln 2 x"));
    expect(normalizeForMatch("e^x")).toBe(normalizeForMatch("e x"));
  });
});

describe("findCitedTextRange", () => {
  it("finds a fragment inside a single text node", () => {
    const container = containerWith(
      "<span>Se acordă 2 puncte pentru idee.</span>",
    );
    const range = findCitedTextRange(container, "2 puncte pentru");
    expect(range).not.toBeNull();
    expect(range!.startNode).toBe(range!.endNode);
    expect(
      range!.startNode.data.slice(range!.startOffset, range!.endOffset),
    ).toBe("2 puncte pentru");
  });

  it("finds a fragment spanning multiple nodes", () => {
    const container = containerWith(
      "<span>a) Rezolvăm </span><span>ecuația de gradul II</span><span> și obținem</span>",
    );
    const range = findCitedTextRange(container, "ecuația de gradul II și");
    expect(range).not.toBeNull();
    const domRange = document.createRange();
    domRange.setStart(range!.startNode, range!.startOffset);
    domRange.setEnd(range!.endNode, range!.endOffset);
    expect(domRange.toString()).toBe("ecuația de gradul II și");
  });

  it("matches despite whitespace and diacritic differences", () => {
    const container = containerWith(
      "<span>Justificare   corectă:   şirul este crescător</span>",
    );
    const range = findCitedTextRange(
      container,
      "justificare corectă: șirul este crescător",
    );
    expect(range).not.toBeNull();
  });

  it("returns null when the fragment is absent", () => {
    const container = containerWith("<span>Text complet diferit.</span>");
    expect(findCitedTextRange(container, "pasaj care nu există")).toBeNull();
  });

  it("returns null for very short needles", () => {
    const container = containerWith("<span>a b c</span>");
    expect(findCitedTextRange(container, "a b")).toBeNull();
  });
});
