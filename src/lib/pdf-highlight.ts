export type CitedTextRange = {
  startNode: Text;
  startOffset: number;
  endNode: Text;
  endOffset: number;
};

/**
 * Folds a string to a comparison-safe form: lowercase letters and digits only,
 * no diacritics, no whitespace, no punctuation. This makes text extracted from
 * a PDF comparable with fragments selected server-side even when whitespace,
 * notation ("ln 2 x" vs "ln^2 x") or Romanian comma/cedilla variants differ.
 */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

type IndexedTextNode = {
  node: Text;
  /** Start index of this node in the concatenated raw text. */
  start: number;
};

function collectTextNodes(container: HTMLElement): IndexedTextNode[] {
  const walker = container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: IndexedTextNode[] = [];
  let offset = 0;
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    if (text.data.length > 0) {
      nodes.push({ node: text, start: offset });
      offset += text.data.length;
    }
    current = walker.nextNode();
  }
  return nodes;
}

type NormalizedHaystack = {
  normalized: string;
  /** normalized index -> start offset in the original text */
  rawStartIndex: number[];
  /** normalized index -> end offset in the original text */
  rawEndIndex: number[];
};

function buildNormalizedHaystack(raw: string): NormalizedHaystack {
  let normalized = "";
  const rawStartIndex: number[] = [];
  const rawEndIndex: number[] = [];
  let rawCursor = 0;

  for (const char of raw) {
    const cleaned = char
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
    for (const kept of cleaned) {
      normalized += kept;
      rawStartIndex.push(rawCursor);
      rawEndIndex.push(rawCursor + char.length);
    }
    rawCursor += char.length;
  }

  return { normalized, rawStartIndex, rawEndIndex };
}

/**
 * Finds the first occurrence of `needle` inside the container's text content,
 * tolerating whitespace/diacritics/notation differences. Returns raw DOM text
 * node boundaries or null when the fragment cannot be located.
 */
export function findCitedTextRange(
  container: HTMLElement,
  needle: string,
): CitedTextRange | null {
  const normalizedNeedle = normalizeForMatch(needle);
  if (normalizedNeedle.length < 4) return null;

  const nodes = collectTextNodes(container);
  if (nodes.length === 0) return null;
  const raw = nodes.map(({ node }) => node.data).join("");
  const { normalized, rawStartIndex, rawEndIndex } =
    buildNormalizedHaystack(raw);

  const matchStart = normalized.indexOf(normalizedNeedle);
  if (matchStart === -1) return null;
  const matchEnd = matchStart + normalizedNeedle.length - 1;

  const rawStart = rawStartIndex[matchStart];
  const rawEnd = rawEndIndex[matchEnd];

  const startNodeIndex = nodes.findIndex(
    (entry, index) =>
      entry.start <= rawStart &&
      rawStart < (nodes[index + 1]?.start ?? Number.MAX_SAFE_INTEGER),
  );
  if (startNodeIndex === -1) return null;

  let endNodeIndex = startNodeIndex;
  while (
    endNodeIndex + 1 < nodes.length &&
    nodes[endNodeIndex + 1].start < rawEnd
  ) {
    endNodeIndex += 1;
  }

  const startEntry = nodes[startNodeIndex];
  const endEntry = nodes[endNodeIndex];
  return {
    startNode: startEntry.node,
    startOffset: rawStart - startEntry.start,
    endNode: endEntry.node,
    endOffset: Math.min(rawEnd - endEntry.start, endEntry.node.data.length),
  };
}

const highlightLayerClass = "pdf-cite-layer";
const highlightBoxClass = "pdf-cite-highlight";

export function clearCitedHighlights(pageRoot: HTMLElement) {
  pageRoot.querySelectorAll(`.${highlightLayerClass}`).forEach((layer) => {
    layer.remove();
  });
}

/**
 * Highlights every cited fragment on a rendered page and returns the first
 * highlight box (used as the scroll target) or null when nothing matched.
 */
export function highlightCitedText(
  pageRoot: HTMLElement,
  fragments: string[],
): HTMLElement | null {
  clearCitedHighlights(pageRoot);
  const textLayer = pageRoot.querySelector<HTMLElement>(".pdf-text-layer");
  if (!textLayer || textLayer.childNodes.length === 0) return null;

  const document = pageRoot.ownerDocument;
  const layer = document.createElement("div");
  layer.className = highlightLayerClass;
  layer.setAttribute("aria-hidden", "true");
  const rootRect = pageRoot.getBoundingClientRect();
  let firstBox: HTMLElement | null = null;

  const seen = new Set<string>();
  for (const fragment of fragments) {
    const dedupeKey = normalizeForMatch(fragment).slice(0, 120);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const range = findCitedTextRange(textLayer, fragment);
    if (!range) continue;

    const domRange = document.createRange();
    domRange.setStart(range.startNode, range.startOffset);
    domRange.setEnd(range.endNode, range.endOffset);

    for (const rect of domRange.getClientRects()) {
      if (rect.width < 1 || rect.height < 1) continue;
      const box = document.createElement("div");
      box.className = highlightBoxClass;
      box.style.left = `${rect.left - rootRect.left}px`;
      box.style.top = `${rect.top - rootRect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      layer.append(box);
      firstBox ??= box;
    }
    domRange.detach();
  }

  if (!firstBox) return null;
  pageRoot.append(layer);
  return firstBox;
}
