import type { ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  Award,
} from "lucide-react";

export type AiSectionKind =
  | "idea"
  | "steps"
  | "verification"
  | "attention"
  | "definition"
  | "scoring";

export type AiSection = {
  kind: AiSectionKind;
  content: string;
};

type SectionMeta = {
  marker: string;
  label: string;
  icon: typeof Lightbulb;
  chipClass: string;
  bodyClass: string;
  topBorderClass: string;
};

const sectionMeta: Record<AiSectionKind, SectionMeta> = {
  idea: {
    marker: "IDEA",
    label: "Ideea cheie",
    icon: Lightbulb,
    chipClass: "bg-indigo-100 text-indigo-800",
    bodyClass: "bg-indigo-50/30",
    topBorderClass: "border-indigo-400",
  },
  steps: {
    marker: "PASI",
    label: "Pași de rezolvare",
    icon: ListChecks,
    chipClass: "bg-emerald-100 text-emerald-800",
    bodyClass: "bg-emerald-50/30",
    topBorderClass: "border-emerald-400",
  },
  verification: {
    marker: "VERIFICARE",
    label: "Verificare",
    icon: CheckCircle2,
    chipClass: "bg-purple-100 text-purple-800",
    bodyClass: "bg-purple-50/30",
    topBorderClass: "border-purple-400",
  },
  attention: {
    marker: "ATENTIE",
    label: "Atenție",
    icon: AlertTriangle,
    chipClass: "bg-amber-100 text-amber-800",
    bodyClass: "bg-amber-50/30",
    topBorderClass: "border-amber-400",
  },
  definition: {
    marker: "DEFINITIE",
    label: "Definiție",
    icon: BookOpen,
    chipClass: "bg-sky-100 text-sky-800",
    bodyClass: "bg-sky-50/30",
    topBorderClass: "border-sky-400",
  },
  scoring: {
    marker: "PUNCTAJ",
    label: "Punctaj",
    icon: Award,
    chipClass: "bg-orange-100 text-orange-800",
    bodyClass: "bg-orange-50/30",
    topBorderClass: "border-orange-400",
  },
};

const markerOrder: AiSectionKind[] = [
  "definition",
  "idea",
  "steps",
  "verification",
  "attention",
  "scoring",
];

const markerPattern = /\[(IDEA|PASI|VERIFICARE|ATENTIE|DEFINITIE|PUNCTAJ)\]/g;

const markerToKind: Record<string, AiSectionKind> = {
  IDEA: "idea",
  PASI: "steps",
  VERIFICARE: "verification",
  ATENTIE: "attention",
  DEFINITIE: "definition",
  PUNCTAJ: "scoring",
};

export function hasSectionMarkers(content: string): boolean {
  markerPattern.lastIndex = 0;
  return markerPattern.test(content);
}

export function parseAiSections(content: string): {
  intro: string;
  sections: AiSection[];
} {
  const trimmed = content.trim();
  const matches: { kind: AiSectionKind; index: number; markerLength: number }[] = [];
  markerPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = markerPattern.exec(trimmed)) !== null) {
    const kind = markerToKind[match[1]];
    if (kind) {
      matches.push({ kind, index: match.index, markerLength: match[0].length });
    }
  }

  if (matches.length === 0) {
    return { intro: trimmed, sections: [] };
  }

  const firstMarkerIndex = matches[0].index;
  const intro = trimmed.slice(0, firstMarkerIndex).trim();

  const sections: AiSection[] = matches.map((entry, i) => {
    const start = entry.index + entry.markerLength;
    const end = i + 1 < matches.length ? matches[i + 1].index : trimmed.length;
    const sectionContent = trimmed.slice(start, end).trim();
    return { kind: entry.kind, content: sectionContent };
  });

  return { intro, sections };
}

export function AiSectionCard({
  kind,
  children,
}: {
  kind: AiSectionKind;
  children: ReactNode;
}) {
  const meta = sectionMeta[kind];
  const Icon = meta.icon;
  return (
    <div
      className={`my-3 overflow-hidden rounded-xl border border-zinc-200 border-t-2 ${meta.topBorderClass} bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}
    >
      <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${meta.chipClass}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
      </div>
      <div className={`px-3.5 py-3 ${meta.bodyClass}`}>
        {children}
      </div>
    </div>
  );
}

export { sectionMeta, markerOrder };