import {
  attemptRecordSchema,
  attemptStoreSchema,
  type AttemptRecord,
  type AttemptStore,
  type GradeResult,
} from "@/lib/schemas";

export const ATTEMPTS_STORAGE_KEY = "iabacu:v1:attempts";
export const ACTIVE_PROGRESS_USER_KEY = "iabacu:v2:active-progress-user";
export const ATTEMPTS_UPDATED_EVENT = "iabacu:attempts-updated";

type BrowserStorage = Pick<Storage, "getItem" | "setItem"> &
  Partial<Pick<Storage, "removeItem">>;

const emptyStore: AttemptStore = {
  version: 1,
  attempts: [],
};

function getStorage(storage?: BrowserStorage): BrowserStorage | undefined {
  if (storage) return storage;
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

function accountStorageKey(userId: string): string {
  return `iabacu:v2:attempts:${userId}`;
}

function activeStorageKey(storage: BrowserStorage): string {
  const userId = storage.getItem(ACTIVE_PROGRESS_USER_KEY);
  return userId ? accountStorageKey(userId) : ATTEMPTS_STORAGE_KEY;
}

export type AttemptsUpdateSource = "local" | "sync";

export function notifyAttemptsUpdated(
  source: AttemptsUpdateSource = "local",
): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ATTEMPTS_UPDATED_EVENT, { detail: { source } }),
    );
  }
}

export function parseAttemptStore(value: string | null): AttemptStore {
  if (!value) return emptyStore;
  try {
    const parsed = JSON.parse(value);
    const store = attemptStoreSchema.safeParse(parsed);
    if (store.success) return store.data;

    if (Array.isArray(parsed)) {
      const attempts: AttemptRecord[] = [];
      for (const item of parsed) {
        const attempt = attemptRecordSchema.safeParse(item);
        if (attempt.success) attempts.push(attempt.data);
      }
      return { version: 1, attempts };
    }
  } catch {
    return emptyStore;
  }

  return emptyStore;
}

export function loadAttemptStore(storage?: BrowserStorage): AttemptStore {
  const target = getStorage(storage);
  if (!target) return emptyStore;
  return parseAttemptStore(target.getItem(activeStorageKey(target)));
}

export function loadAttempts(storage?: BrowserStorage): AttemptRecord[] {
  return loadAttemptStore(storage).attempts;
}

export function writeAttemptStore(
  store: AttemptStore,
  storage?: BrowserStorage,
): void {
  const target = getStorage(storage);
  if (!target) return;
  target.setItem(activeStorageKey(target), JSON.stringify(store));
}

export function writeSyncedAttemptStore(
  store: AttemptStore,
  storage?: BrowserStorage,
): void {
  writeAttemptStore(store, storage);
  notifyAttemptsUpdated("sync");
}

export function mergeAttemptRecords(
  ...collections: AttemptRecord[][]
): AttemptRecord[] {
  const attempts = new Map<string, AttemptRecord>();
  for (const collection of collections) {
    for (const value of collection) {
      const attempt = attemptRecordSchema.safeParse(value);
      if (!attempt.success) continue;
      const existing = attempts.get(attempt.data.id);
      if (
        !existing ||
        new Date(attempt.data.createdAt).getTime() >=
          new Date(existing.createdAt).getTime()
      ) {
        attempts.set(attempt.data.id, attempt.data);
      }
    }
  }
  return Array.from(attempts.values()).toSorted(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function activateProgressUser(
  userId: string,
  storage?: BrowserStorage,
): AttemptRecord[] {
  const target = getStorage(storage);
  if (!target) return [];

  const anonymous = parseAttemptStore(
    target.getItem(ATTEMPTS_STORAGE_KEY),
  ).attempts;
  const account = parseAttemptStore(
    target.getItem(accountStorageKey(userId)),
  ).attempts;
  const attempts = mergeAttemptRecords(account, anonymous);

  target.setItem(ACTIVE_PROGRESS_USER_KEY, userId);
  target.setItem(
    accountStorageKey(userId),
    JSON.stringify({ version: 1, attempts }),
  );
  target.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(emptyStore));
  notifyAttemptsUpdated();
  return attempts;
}

export function deactivateProgressUser(storage?: BrowserStorage): void {
  const target = getStorage(storage);
  if (!target) return;
  if (target.removeItem) target.removeItem(ACTIVE_PROGRESS_USER_KEY);
  else target.setItem(ACTIVE_PROGRESS_USER_KEY, "");
  notifyAttemptsUpdated();
}

export function hasActiveProgressUser(storage?: BrowserStorage): boolean {
  return Boolean(getStorage(storage)?.getItem(ACTIVE_PROGRESS_USER_KEY));
}

export function saveAttemptRecord(
  attempt: AttemptRecord,
  storage?: BrowserStorage,
): AttemptStore {
  const validAttempt = attemptRecordSchema.parse(attempt);
  const current = loadAttemptStore(storage);
  const attempts = mergeAttemptRecords(current.attempts, [validAttempt]);
  const next = { version: 1 as const, attempts };
  writeAttemptStore(next, storage);
  notifyAttemptsUpdated();
  return next;
}

export function saveGradingAttempt(
  examId: string,
  gradeResult: GradeResult,
  createdAt: string,
  storage?: BrowserStorage,
): AttemptStore {
  return saveAttemptRecord(
    {
      id: `grading:${examId}:${createdAt}`,
      examId,
      score: gradeResult.totalScore,
      createdAt,
      source: "ai",
      gradeResult,
    },
    storage,
  );
}

export function bestScoreForExam(
  examId: string,
  attempts: AttemptRecord[],
): number | undefined {
  return attempts
    .filter((attempt) => attempt.examId === examId)
    .reduce<number | undefined>(
      (best, attempt) =>
        best == null ? attempt.score : Math.max(best, attempt.score),
      undefined,
    );
}
