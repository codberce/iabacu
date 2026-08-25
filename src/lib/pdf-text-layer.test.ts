import { describe, expect, it } from "vitest";
import { syncTextLayerSpanWidths } from "./pdf-text-layer";

function makeSpan(text: string, offsetWidth: number): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = text;
  Object.defineProperty(span, "offsetWidth", { value: offsetWidth });
  return span;
}

function makeContainer(spans: HTMLSpanElement[], minFontSize = ""): HTMLElement {
  const container = document.createElement("div");
  container.append(...spans);
  if (minFontSize) {
    container.style.setProperty("--min-font-size", minFontSize);
  }
  return container;
}

function setRect(
  element: Element,
  { left, top, width, height }: { left: number; top: number; width: number; height: number },
): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: () => ({}),
    }),
  });
}

const noVerticalStyles = {};

describe("syncTextLayerSpanWidths", () => {
  it("scales single-character symbols to their PDF advance width", () => {
    const paren = makeSpan("(", 12);
    syncTextLayerSpanWidths(
      makeContainer([paren]),
      [{ str: "(", width: 4, fontName: "f1" }],
      noVerticalStyles,
      2,
    );
    // target = 4 * 2 = 8px, natural = 12px
    expect(paren.style.getPropertyValue("--scale-x")).toBe(String(8 / 12));
  });

  it("leaves spans within half a pixel of their target untouched", () => {
    const tight = makeSpan("x", 10);
    syncTextLayerSpanWidths(
      makeContainer([tight]),
      [{ str: "x", width: 5.1, fontName: "f1" }],
      noVerticalStyles,
      2,
    );
    expect(tight.style.getPropertyValue("--scale-x")).toBe("");
  });

  it("stretches whitespace spacers and drops them below glyph spans", () => {
    const spacer = makeSpan(" ", 3);
    const tightSpacer = makeSpan(" ", 10);
    syncTextLayerSpanWidths(
      makeContainer([spacer, tightSpacer]),
      [
        { str: " ", width: 300, fontName: "f1", transform: [12, 0, 0, 12, 0, 0] },
        { str: " ", width: 9.8, fontName: "f1", transform: [12, 0, 0, 12, 400, 0] },
      ],
      noVerticalStyles,
      1,
    );
    expect(spacer.style.getPropertyValue("--scale-x")).toBe(String(300 / 3));
    expect(spacer.style.zIndex).toBe("0");
    expect(spacer.classList.contains("pdf-spacer")).toBe(true);
    // no benefit in stretching when the advance is already covered
    expect(tightSpacer.style.getPropertyValue("--scale-x")).toBe("");
    expect(tightSpacer.style.zIndex).toBe("");
  });

  it("caps spacers whose advance contains positioned glyphs", () => {
    const spacer = makeSpan(" ", 3);
    // glyph drawn 10 units into the spacer's 300-unit advance
    syncTextLayerSpanWidths(
      makeContainer([spacer, makeSpan("x", 4)]),
      [
        { str: " ", width: 300, fontName: "f1", transform: [12, 0, 0, 12, 100, 500] },
        { str: "x", width: 5, fontName: "f1", transform: [12, 0, 0, 12, 110, 500] },
      ],
      noVerticalStyles,
      1,
    );
    expect(spacer.style.getPropertyValue("--scale-x")).toBe(String(10 / 3));
    expect(spacer.style.zIndex).toBe("0");
  });

  it("ignores glyphs on other lines when capping spacer stretch", () => {
    const spacer = makeSpan(" ", 3);
    syncTextLayerSpanWidths(
      makeContainer([spacer, makeSpan("x", 4)]),
      [
        { str: " ", width: 300, fontName: "f1", transform: [12, 0, 0, 12, 100, 500] },
        // same left edge band but a full line below
        { str: "x", width: 5, fontName: "f1", transform: [12, 0, 0, 12, 110, 470] },
      ],
      noVerticalStyles,
      1,
    );
    expect(spacer.style.getPropertyValue("--scale-x")).toBe(String(300 / 3));
  });

  it("reorders flat text layers into visual line order", () => {
    const lead = makeSpan("Arătați că", 50);
    const comma = makeSpan(",", 3);
    const formula = makeSpan("x", 5);
    const spacer = makeSpan(" ", 3);
    const suffix = makeSpan("oricare", 30);
    const container = makeContainer([lead, comma, formula, spacer, suffix]);

    syncTextLayerSpanWidths(
      container,
      [
        { str: "Arătați că", width: 47, fontName: "f1", transform: [12, 0, 0, 12, 90, 500] },
        { str: ",", width: 3, fontName: "f1", transform: [12, 0, 0, 12, 210, 500] },
        { str: "x", width: 5, fontName: "f1", transform: [12, 0, 0, 12, 145, 500] },
        { str: " ", width: 75, fontName: "f1", transform: [12, 0, 0, 12, 137, 500] },
        { str: "oricare", width: 30, fontName: "f1", transform: [12, 0, 0, 12, 220, 500] },
      ],
      noVerticalStyles,
      1,
    );

    expect([...container.querySelectorAll("span")].map((span) => span.textContent)).toEqual([
      "Arătați că",
      " ",
      "x",
      ",",
      "oricare",
    ]);
  });

  it("keeps each line break attached to its visual span", () => {
    const later = makeSpan("later", 20);
    const first = makeSpan("first", 20);
    const br = document.createElement("br");
    const container = makeContainer([later, first]);
    container.insertBefore(br, first);

    syncTextLayerSpanWidths(
      container,
      [
        { str: "later", width: 20, fontName: "f1", transform: [12, 0, 0, 12, 200, 500] },
        { str: "first", width: 20, fontName: "f1", transform: [12, 0, 0, 12, 100, 500] },
      ],
      noVerticalStyles,
      1,
    );

    expect([...container.children].map((child) => child.tagName + child.textContent)).toEqual([
      "SPANfirst",
      "SPANlater",
      "BR",
    ]);
  });

  it("fills uncovered visual gaps with local caret anchors", () => {
    const first = makeSpan("first", 20);
    const second = makeSpan("second", 20);
    const container = makeContainer([first, second]);
    setRect(container, { left: 0, top: 0, width: 200, height: 100 });
    setRect(first, { left: 10, top: 20, width: 20, height: 12 });
    setRect(second, { left: 40, top: 20, width: 20, height: 12 });

    syncTextLayerSpanWidths(
      container,
      [
        { str: "first", width: 20, fontName: "f1", transform: [12, 0, 0, 12, 10, 500] },
        { str: "second", width: 20, fontName: "f1", transform: [12, 0, 0, 12, 40, 500] },
      ],
      noVerticalStyles,
      1,
    );

    const guard = container.querySelector<HTMLElement>(".pdf-gap-anchor");
    expect(guard).not.toBeNull();
    expect(guard!.textContent).toBe(" ");
    expect(guard!.style.left).toBe("30px");
    expect(guard!.style.width).toBe("10px");
    expect([...container.children]).toEqual([first, guard, second]);
  });

  it("pairs spans with non-empty items only", () => {
    const first = makeSpan("a", 8);
    const second = makeSpan("bc", 20);
    syncTextLayerSpanWidths(
      makeContainer([first, second]),
      [
        { str: "", width: 0, fontName: "f1" },
        { str: "a", width: 6, fontName: "f1" },
        { str: "bc", width: 5, fontName: "f1" },
      ],
      noVerticalStyles,
      1,
    );
    expect(first.style.getPropertyValue("--scale-x")).toBe(String(6 / 8));
    expect(second.style.getPropertyValue("--scale-x")).toBe(String(5 / 20));
  });

  it("multiplies by the container's minimum font size compensation", () => {
    const span = makeSpan("√", 10);
    syncTextLayerSpanWidths(
      makeContainer([span], "4"),
      [{ str: "√", width: 5, fontName: "f1" }],
      noVerticalStyles,
      1,
    );
    // target = 5px, layout is inflated 4x by the browser font clamp
    expect(span.style.getPropertyValue("--scale-x")).toBe(String((5 * 4) / 10));
  });

  it("uses item height as advance for vertical writing modes", () => {
    const span = makeSpan("A", 10);
    syncTextLayerSpanWidths(
      makeContainer([span]),
      [{ str: "A", width: 99, height: 7, fontName: "fv" }],
      { fv: { vertical: true } },
      1,
    );
    expect(span.style.getPropertyValue("--scale-x")).toBe(String(7 / 10));
  });

  it("ignores spans with zero layout width and extra items without spans", () => {
    const collapsed = makeSpan("·", 0);
    const normal = makeSpan("ab", 9);
    syncTextLayerSpanWidths(
      makeContainer([collapsed, normal]),
      [
        { str: "·", width: 3, fontName: "f1" },
        { str: "ab", width: 6, fontName: "f1" },
        { str: "c", width: 2, fontName: "f1" },
      ],
      noVerticalStyles,
      1,
    );
    expect(collapsed.style.getPropertyValue("--scale-x")).toBe("");
    expect(normal.style.getPropertyValue("--scale-x")).toBe(String(6 / 9));
  });

  it("skips non-finite advances instead of corrupting transforms", () => {
    const span = makeSpan("x", 10);
    syncTextLayerSpanWidths(
      makeContainer([span]),
      [{ str: "x", width: Number.NaN, fontName: "f1" }],
      noVerticalStyles,
      1,
    );
    expect(span.style.getPropertyValue("--scale-x")).toBe("");
  });
});
