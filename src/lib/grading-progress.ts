const progressFloor = 0;
const progressCeil = 95;
const baseGradingTimeMs = 9_000;
const perImageTimeMs = 80;

export const gradingStages: { atMs: number; message: string }[] = [
  { atMs: 0, message: "Pregătim pozele pentru trimitere…" },
  { atMs: 2_000, message: "Trimitem lucrarea la corectorul AI…" },
  { atMs: 5_000, message: "Corectorul citește pozele tale…" },
  { atMs: 7_000, message: "Comparăm răspunsurile cu baremul oficial…" },
  { atMs: 8_500, message: "Calculăm punctajul pe fiecare item…" },
];

export function gradingProgress(elapsedMs: number, imageCount: number = 1): number {
  if (elapsedMs <= 0) return progressFloor;
  const expectedTimeMs = baseGradingTimeMs + (imageCount - 1) * perImageTimeMs;
  const raw = 100 * (1 - 1 / (1 + elapsedMs / expectedTimeMs));
  return Math.max(progressFloor, Math.min(progressCeil, Math.round(raw)));
}

export function gradingStageMessage(elapsedMs: number): string {
  let message = gradingStages[0].message;
  for (const stage of gradingStages) {
    if (elapsedMs >= stage.atMs) message = stage.message;
  }
  return message;
}