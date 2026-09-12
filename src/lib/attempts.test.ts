import { describe, expect, it } from "vitest";
import {
  ACTIVE_PROGRESS_USER_KEY,
  ATTEMPTS_STORAGE_KEY,
  activateProgressUser,
  bestScoreForExam,
  deactivateProgressUser,
  loadAttempts,
  mergeAttemptRecords,
  parseAttemptStore,
  saveGradingAttempt,
  saveAttemptRecord,
  writeSyncedAttemptStore,
} from "./attempts";

const gradeResult = {
  totalScore: 9.6,
  rawPoints: 96,
  confidence: 0.9,
  breakdown: [
    {
      section: "Subiectul I",
      item: "1",
      maxPoints: 5,
      awardedPoints: 5,
      feedback: "Corect.",
    },
  ],
  unclearWorkWarnings: [],
  manualReviewNotes: [],
};

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("attempt storage", () => {
  it("returns an empty v1 store for invalid data", () => {
    expect(parseAttemptStore("not-json")).toEqual({ version: 1, attempts: [] });
    expect(parseAttemptStore(null)).toEqual({ version: 1, attempts: [] });
  });

  it("saves and reads attempts from the requested localStorage key", () => {
    const storage = new MemoryStorage();
    saveAttemptRecord(
      {
        id: "attempt-1",
        examId: "exam-1",
        score: 9.6,
        createdAt: "2026-07-07T10:00:00.000Z",
        source: "ai",
        gradeResult,
      },
      storage,
    );

    expect(storage.getItem(ATTEMPTS_STORAGE_KEY)).toContain("attempt-1");
    expect(loadAttempts(storage)).toHaveLength(1);
    expect(bestScoreForExam("exam-1", loadAttempts(storage))).toBe(9.6);
  });

  it("updates one automatic attempt as a grading result is adjusted", () => {
    const storage = new MemoryStorage();
    const gradedAt = "2026-07-19T10:00:00.000Z";

    saveGradingAttempt("exam-1", gradeResult, gradedAt, storage);
    saveGradingAttempt(
      "exam-1",
      { ...gradeResult, totalScore: 9.8, rawPoints: 98 },
      gradedAt,
      storage,
    );

    expect(loadAttempts(storage)).toHaveLength(1);
    expect(bestScoreForExam("exam-1", loadAttempts(storage))).toBe(9.8);
  });

  it("migrates anonymous progress into an isolated account cache", () => {
    const storage = new MemoryStorage();
    saveAttemptRecord(
      {
        id: "anonymous-attempt",
        examId: "exam-1",
        score: 9.6,
        createdAt: "2026-07-07T10:00:00.000Z",
        source: "ai",
        gradeResult,
      },
      storage,
    );

    expect(activateProgressUser("user-1", storage)).toHaveLength(1);
    expect(storage.getItem(ACTIVE_PROGRESS_USER_KEY)).toBe("user-1");
    expect(loadAttempts(storage)[0]?.id).toBe("anonymous-attempt");
    expect(storage.getItem(ATTEMPTS_STORAGE_KEY)).toBe(
      JSON.stringify({ version: 1, attempts: [] }),
    );

    deactivateProgressUser(storage);
    expect(loadAttempts(storage)).toEqual([]);
  });

  it("deduplicates merged local and remote attempts", () => {
    const attempt = {
      id: "attempt-1",
      examId: "exam-1",
      score: 9.6,
      createdAt: "2026-07-07T10:00:00.000Z",
      source: "ai" as const,
      gradeResult,
    };
    expect(mergeAttemptRecords([attempt], [attempt])).toEqual([attempt]);
  });

  it("notifies open views when synced attempts replace the account cache", () => {
    const storage = new MemoryStorage();
    let updateSource: string | undefined;
    const handleUpdate = (event: Event) => {
      updateSource = (event as CustomEvent<{ source?: string }>).detail?.source;
    };
    window.addEventListener("iabacu:attempts-updated", handleUpdate, { once: true });

    writeSyncedAttemptStore({
      version: 1,
      attempts: [{
        id: "synced-attempt",
        examId: "exam-1",
        score: 1,
        createdAt: "2026-07-19T10:00:00.000Z",
        source: "ai",
        gradeResult: { ...gradeResult, totalScore: 1, rawPoints: 10 },
      }],
    }, storage);

    expect(loadAttempts(storage)[0]?.id).toBe("synced-attempt");
    expect(updateSource).toBe("sync");
  });
});
