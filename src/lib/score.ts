import type { AttemptRecord } from "@/lib/schemas";

export type ScoreBandKey =
  | "dark-green"
  | "light-green"
  | "yellow"
  | "orange"
  | "red"
  | "neutral";

export type ScoreBand = {
  key: ScoreBandKey;
  label: string;
  tileClass: string;
  badgeClass: string;
};

const bands: Record<ScoreBandKey, ScoreBand> = {
  "dark-green": {
    key: "dark-green",
    label: ">= 9.50",
    tileClass: "border-emerald-900 bg-emerald-950 text-white",
    badgeClass: "bg-emerald-900 text-white",
  },
  "light-green": {
    key: "light-green",
    label: ">= 9",
    tileClass: "border-emerald-300 bg-emerald-100 text-emerald-950",
    badgeClass: "bg-emerald-200 text-emerald-950",
  },
  yellow: {
    key: "yellow",
    label: ">= 8",
    tileClass: "border-yellow-300 bg-yellow-100 text-yellow-950",
    badgeClass: "bg-yellow-200 text-yellow-950",
  },
  orange: {
    key: "orange",
    label: ">= 7",
    tileClass: "border-orange-300 bg-orange-100 text-orange-950",
    badgeClass: "bg-orange-200 text-orange-950",
  },
  red: {
    key: "red",
    label: "< 7",
    tileClass: "border-red-300 bg-red-100 text-red-950",
    badgeClass: "bg-red-200 text-red-950",
  },
  neutral: {
    key: "neutral",
    label: "Neînceput",
    tileClass: "border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400",
    badgeClass: "bg-zinc-100 text-zinc-700",
  },
};

export function scoreBand(score?: number | null): ScoreBand {
  if (score == null || Number.isNaN(score)) return bands.neutral;
  if (score >= 9.5) return bands["dark-green"];
  if (score >= 9) return bands["light-green"];
  if (score >= 8) return bands.yellow;
  if (score >= 7) return bands.orange;
  return bands.red;
}

export function clampScore(score: number): number {
  return Math.min(10, Math.max(1, Number(score.toFixed(2))));
}

export function formatScore(score?: number | null): string {
  if (score == null || Number.isNaN(score)) return "-";
  return score.toFixed(2);
}

export function bestAttemptForExam(
  examId: string,
  attempts: AttemptRecord[],
): AttemptRecord | undefined {
  return attempts
    .filter((attempt) => attempt.examId === examId)
    .toSorted((a, b) => b.score - a.score)[0];
}
