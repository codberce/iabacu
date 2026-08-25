type TextGeometryItem = {
  str?: string;
  width?: number;
  height?: number;
  fontName?: string;
  transform?: number[];
  /** Present on marked-content markers, which carry no text. */
  type?: string;
};

type TextGeometryStyles = Record<string, { vertical?: boolean } | undefined>;

type ItemBox = {
  index: number;
  left: number;
  right: number;
  baseline: number;
  fontHeight: number;
  rotated: boolean;
};

type VisualEntry = {
  span: HTMLElement;
  trailingBreaks: HTMLBRElement[];
  box: ItemBox;
};

type VisualLine = {
  anchor: ItemBox;
  entries: VisualEntry[];
};

function isWhitespace(item: TextGeometryItem): boolean {
  return typeof item.str !== "string" || item.str.trim() === "";
}

function reorderFlatTextLayer(
  container: HTMLElement,
  spans: NodeListOf<HTMLElement>,
  boxes: readonly (ItemBox | null)[],
): void {
  // Moving leaves out of marked-content wrappers would lose semantic PDF
  // structure. Flat text layers are safe to reorder because all geometry
  // and font information is inline on their absolutely positioned spans.
  if (container.querySelector(".markedContent")) return;

  const bySpan = new Map<HTMLElement, VisualEntry>();
  for (let index = 0; index < spans.length; index += 1) {
    const box = boxes[index];
    if (!box) return;
    bySpan.set(spans[index], {
      span: spans[index],
      trailingBreaks: [],
      box,
    });
  }

  const entries: VisualEntry[] = [];
  let previous: VisualEntry | undefined;
  for (const child of container.children) {
    if (child instanceof HTMLSpanElement) {
      const entry = bySpan.get(child);
      if (!entry) return;
      entries.push(entry);
      previous = entry;
    } else if (child instanceof HTMLBRElement && previous) {
      previous.trailingBreaks.push(child);
    } else {
      return;
    }
  }
  if (entries.length !== spans.length) return;

  const lines: VisualLine[] = [];
  for (const entry of [...entries].sort(
    (left, right) => right.box.baseline - left.box.baseline,
  )) {
    let line = lines.find(
      (candidate) =>
        Math.abs(candidate.anchor.baseline - entry.box.baseline) <=
        1.1 * Math.max(candidate.anchor.fontHeight, entry.box.fontHeight),
    );
    if (!line) {
      line = { anchor: entry.box, entries: [] };
      lines.push(line);
    } else if (entry.box.fontHeight > line.anchor.fontHeight) {
      line.anchor = entry.box;
    }
    line.entries.push(entry);
  }

  lines.sort((left, right) => right.anchor.baseline - left.anchor.baseline);
  const fragment = container.ownerDocument.createDocumentFragment();
  for (const line of lines) {
    line.entries.sort(
      (left, right) =>
        left.box.left - right.box.left ||
        right.box.baseline - left.box.baseline,
    );
    const lineBreaks = line.entries.flatMap((entry) => entry.trailingBreaks);
    for (const entry of line.entries) {
      fragment.append(entry.span);
    }
    if (lineBreaks.length > 0) {
      fragment.append(lineBreaks[0]);
      for (const extraBreak of lineBreaks.slice(1)) extraBreak.remove();
    }
  }
  container.append(fragment);

  const containerRect = container.getBoundingClientRect();
  const guards: {
    next: HTMLElement;
    left: number;
    top: number;
    width: number;
    height: number;
  }[] = [];
  for (const line of lines) {
    const anchorEntry = line.entries.find(
      (entry) => entry.box === line.anchor,
    );
    if (!anchorEntry) continue;
    const anchorRect = anchorEntry.span.getBoundingClientRect();

    for (let index = 0; index + 1 < line.entries.length; index += 1) {
      const current = line.entries[index];
      const next = line.entries[index + 1];
      const currentRect = current.span.getBoundingClientRect();
      const nextRect = next.span.getBoundingClientRect();
      const gap = nextRect.left - currentRect.right;
      if (gap <= 1) continue;

      guards.push({
        next: next.span,
        left: currentRect.right - containerRect.left,
        top: anchorRect.top - containerRect.top,
        width: gap,
        height: anchorRect.height,
      });
    }
  }

  for (const geometry of guards) {
    const guard = container.ownerDocument.createElement("span");
    guard.className = "pdf-gap-anchor";
    guard.setAttribute("role", "presentation");
    guard.setAttribute("aria-hidden", "true");
    guard.textContent = " ";
    guard.style.left = `${geometry.left}px`;
    guard.style.top = `${geometry.top}px`;
    guard.style.width = `${geometry.width}px`;
    guard.style.height = `${geometry.height}px`;
    guard.style.fontSize = "1px";
    guard.style.transform = "none";
    guard.style.zIndex = "0";
    container.insertBefore(guard, geometry.next);
  }
}

/**
 * Corrects the invisible selection hitboxes of a rendered pdf.js TextLayer.
 *
 * pdf.js only compensates span width (`--scale-x`) for multi-character
 * items measured with fallback fonts. Single-character items, which make
 * up most math notation (operators, squeezed parentheses, big symbols),
 * keep their fallback-font width, so their hitboxes can be far wider or
 * narrower than the drawn glyphs and selection lands on the wrong text.
 *
 * Whitespace-only items need opposite care: exam PDFs use huge single
 * spaces as layout spacers, and leaving them narrow opens dead zones that
 * let a drag-selection jump to unrelated lines. They are stretched to
 * cover genuinely empty advances. Spacers whose advance overlaps glyphs
 * are capped at the first glyph. Once the spans are reordered visually,
 * that short spacer is the correct range endpoint for the blank after the
 * preceding word. Spacers are pushed below glyph spans (`z-index: 0` vs
 * the stylesheet's `z-index: 1`) and marked `.pdf-spacer` so their
 * selection background can be hidden.
 */
export function syncTextLayerSpanWidths(
  container: HTMLElement,
  items: readonly TextGeometryItem[],
  styles: TextGeometryStyles,
  cssScale: number,
): void {
  const withText = items.filter(
    (item) => typeof item.str === "string" && item.str !== "",
  );
  const spans = container.querySelectorAll<HTMLElement>(
    "span:not(.markedContent)",
  );
  const count = Math.min(spans.length, withText.length);
  const minFontSize =
    Number.parseFloat(container.style.getPropertyValue("--min-font-size")) ||
    1;

  // Read every span before writing any style so the browser relayouts once.
  const naturals: number[] = new Array(count).fill(0);
  for (let index = 0; index < count; index += 1) {
    const natural = spans[index].offsetWidth;
    if (natural > 0) naturals[index] = natural;
  }

  const boxes: (ItemBox | null)[] = new Array(count).fill(null);
  for (let index = 0; index < count; index += 1) {
    const item = withText[index];
    const transform = item.transform;
    if (!transform || transform.length < 6) continue;
    const [, b, c, d, e, f] = transform;
    boxes[index] = {
      index,
      left: e,
      right: e + (item.width ?? 0),
      baseline: f,
      fontHeight: Math.hypot(c, d),
      rotated: Math.abs(b) > 0.0001 || Math.abs(c) > 0.0001,
    };
  }

  for (let index = 0; index < count; index += 1) {
    const natural = naturals[index];
    if (!natural) continue;
    const item = withText[index];
    const span = spans[index];

    const advance = styles[item.fontName ?? ""]?.vertical
      ? item.height
      : item.width;
    if (typeof advance !== "number" || !Number.isFinite(advance)) continue;
    let target = advance * cssScale;
    if (!Number.isFinite(target)) continue;

    if (!isWhitespace(item)) {
      if (Math.abs(target - natural) <= 0.5) continue;
      span.style.setProperty(
        "--scale-x",
        String((target * minFontSize) / natural),
      );
      continue;
    }

    // A spacer containing positioned glyphs is a PDF layout instruction.
    // Keep only its genuinely empty leading part; visual DOM reordering
    // then makes that short span the correct endpoint after the previous
    // word instead of a range that covers the whole formula.
    const box = boxes[index];
    let firstGlyphLeft = Number.POSITIVE_INFINITY;
    if (box && !box.rotated) {
      for (const other of boxes) {
        if (
          !other ||
          other === box ||
          other.rotated ||
          isWhitespace(withText[other.index])
        ) {
          continue;
        }
        if (
          Math.abs(other.baseline - box.baseline) >
          0.6 * Math.max(other.fontHeight, box.fontHeight)
        ) {
          continue;
        }
        if (other.left <= box.left + 0.3 || other.left >= box.right - 0.3) {
          continue;
        }
        firstGlyphLeft = Math.min(firstGlyphLeft, other.left);
      }
    }
    if (Number.isFinite(firstGlyphLeft)) {
      target = Math.min(target, (firstGlyphLeft - box!.left) * cssScale);
    }
    if (target <= natural + 0.5) continue;

    span.style.zIndex = "0";
    span.classList.add("pdf-spacer");
    span.style.setProperty(
      "--scale-x",
      String((target * minFontSize) / natural),
    );
  }

  reorderFlatTextLayer(container, spans, boxes);
}
