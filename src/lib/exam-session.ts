export type ExamTimerSnapshot = {
  version: 1;
  durationSeconds: number;
  isRunning: boolean;
  startedAt: number | null;
  elapsedBeforePause: number;
};

export type RestoredExamTimer = {
  isRunning: boolean;
  startedAt: number | null;
  elapsedBeforePause: number;
  remaining: number;
};

export function examTimerStorageKey(examId: string) {
  return `iabacu:v1:exam-timer:${examId}`;
}

export function parseExamTimerSnapshot(value: string | null): ExamTimerSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ExamTimerSnapshot>;
    if (
      parsed.version !== 1 ||
      typeof parsed.durationSeconds !== "number" ||
      typeof parsed.isRunning !== "boolean" ||
      !(typeof parsed.startedAt === "number" || parsed.startedAt === null) ||
      typeof parsed.elapsedBeforePause !== "number"
    ) return null;
    return {
      version: 1,
      durationSeconds: Math.max(1, Math.floor(parsed.durationSeconds)),
      isRunning: parsed.isRunning,
      startedAt: parsed.startedAt,
      elapsedBeforePause: Math.max(0, Math.floor(parsed.elapsedBeforePause)),
    };
  } catch {
    return null;
  }
}

export function restoreExamTimer(snapshot: ExamTimerSnapshot | null, durationSeconds: number, nowMs = Date.now()): RestoredExamTimer {
  if (!snapshot || snapshot.durationSeconds !== durationSeconds) {
    return { isRunning: false, startedAt: null, elapsedBeforePause: 0, remaining: durationSeconds };
  }
  const liveElapsed = snapshot.isRunning && snapshot.startedAt != null
    ? Math.floor(Math.max(0, nowMs - snapshot.startedAt) / 1000)
    : 0;
  const totalElapsed = Math.min(durationSeconds, snapshot.elapsedBeforePause + liveElapsed);
  const remaining = Math.max(0, durationSeconds - totalElapsed);
  if (remaining === 0) {
    return { isRunning: false, startedAt: null, elapsedBeforePause: durationSeconds, remaining: 0 };
  }
  return {
    isRunning: snapshot.isRunning && snapshot.startedAt != null,
    startedAt: snapshot.isRunning ? snapshot.startedAt : null,
    elapsedBeforePause: snapshot.elapsedBeforePause,
    remaining,
  };
}
