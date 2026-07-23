export const EXAM_DURATION_SECONDS = 3 * 60 * 60;

export function remainingSeconds(
  startedAtMs: number,
  nowMs: number,
  durationSeconds = EXAM_DURATION_SECONDS,
): number {
  const elapsed = Math.floor((nowMs - startedAtMs) / 1000);
  return Math.max(0, durationSeconds - elapsed);
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
