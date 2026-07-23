import type { ExtractedExamContext } from "@/lib/grading";

export type ContextPage = {
  page: number;
  text: string;
};

export type RubricItemTarget = {
  section: string;
  item: string;
};

export type PageGroundedContext = ExtractedExamContext & {
  grounding: {
    targetLabel: string;
    subjectPages: number[];
    baremPages: number[];
  };
};

const pageMarker = /^--- page\s+(\d+)\s+---\s*$/gim;
const fragmentSeparator = "\n\n--- fragment relevant ---\n\n";

export function splitContextPages(text: string): ContextPage[] {
  const markers = [...text.matchAll(pageMarker)];
  if (markers.length === 0) return [{ page: 1, text: text.trim() }];

  return markers
    .map((marker, index) => {
      const start = (marker.index ?? 0) + marker[0].length;
      const end = markers[index + 1]?.index ?? text.length;
      return { page: Number(marker[1]), text: text.slice(start, end).trim() };
    })
    .filter((page) => page.text.length > 0);
}

function normalized(value: string) {
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function itemNeedles(target: RubricItemTarget) {
  const label = normalized(`${target.section} ${target.item}`);
  const item = normalized(target.item);
  const match = item.match(/(\d{1,2})(?:\s*[.)-]?\s*([a-c]))?/);
  const section = label.match(/subiect(?:ul)?\s+(iii|ii|i|3|2|1)/)?.[1];
  const needles = [target.section, target.item];
  if (section) needles.push(`subiectul ${section}`);
  if (match?.[1]) {
    needles.push(`${match[1]}.`);
    if (match[2]) needles.push(`${match[1]}.${match[2]}`, `${match[2]})`);
  }
  return [...new Set(needles.map(normalized).filter(Boolean))];
}

function selectFragments(pages: ContextPage[], target: RubricItemTarget) {
  const needles = itemNeedles(target);
  const matches = pages.filter((page) => {
    const text = normalized(page.text);
    return needles.some((needle) => text.includes(needle));
  });
  const candidates = matches.length > 0 ? matches : pages.slice(0, 1);

  return candidates.map((page) => {
    const lower = normalized(page.text);
    const matchAt = needles
      .map((needle) => lower.indexOf(needle))
      .find((index) => index >= 0) ?? 0;
    return {
      page: page.page,
      text: page.text.slice(Math.max(0, matchAt - 1200), matchAt + 5000).trim(),
    };
  });
}

/** Selects only the document neighbourhood needed for one declared official item. */
export function selectRubricItemContext(
  context: ExtractedExamContext,
  target: RubricItemTarget,
): PageGroundedContext {
  const subject = selectFragments(splitContextPages(context.subjectText), target);
  const barem = selectFragments(splitContextPages(context.baremText), target);
  const targetLabel = `${target.section}, itemul ${target.item}`;
  return {
    examId: context.examId,
    subjectText: subject.map((fragment) => fragment.text).join(fragmentSeparator),
    baremText: barem.map((fragment) => fragment.text).join(fragmentSeparator),
    grounding: {
      targetLabel,
      subjectPages: subject.map((fragment) => fragment.page),
      baremPages: barem.map((fragment) => fragment.page),
    },
  };
}

export function rubricPageForItem(
  context: ExtractedExamContext,
  target: RubricItemTarget,
) {
  return selectRubricItemContext(context, target).grounding.baremPages[0] ?? 1;
}
