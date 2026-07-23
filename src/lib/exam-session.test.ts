import { describe, expect, it } from "vitest";
import { parseExamTimerSnapshot, restoreExamTimer } from "@/lib/exam-session";

describe("persistent exam timer", () => {
  it("restores a running timer using wall-clock time", () => {
    const restored = restoreExamTimer({ version: 1, durationSeconds: 180, isRunning: true, startedAt: 10_000, elapsedBeforePause: 20 }, 180, 40_000);
    expect(restored.remaining).toBe(130);
    expect(restored.isRunning).toBe(true);
  });

  it("expires safely while the page is closed", () => {
    const restored = restoreExamTimer({ version: 1, durationSeconds: 60, isRunning: true, startedAt: 0, elapsedBeforePause: 0 }, 60, 120_000);
    expect(restored).toMatchObject({ remaining: 0, isRunning: false, elapsedBeforePause: 60 });
  });

  it("ignores malformed or obsolete snapshots", () => {
    expect(parseExamTimerSnapshot("not-json")).toBeNull();
    expect(restoreExamTimer({ version: 1, durationSeconds: 240, isRunning: false, startedAt: null, elapsedBeforePause: 10 }, 180).remaining).toBe(180);
  });
});
