import { examContextSchema, type ExamContext } from "@/lib/study-exam-context";
import { z } from "zod";
import { ACTIVE_PROGRESS_USER_KEY, loadAttempts } from "@/lib/attempts";
import { safeReturnPath } from "@/lib/return-path";
import { getExamVariants } from "@/lib/exam-variants";
import { readBrowserStorage, writeBrowserStorage } from "@/lib/safe-browser-storage";
import type { AttemptRecord, Exam } from "@/lib/schemas";

export const STUDY_HISTORY_EVENT = "iabacu:study-history";
const prefix = "iabacu:v1:study-history";
const historySchema = z.object({
  sessions: z.array(z.object({
    examId: z.string().min(1).max(200),
    title: z.string().max(300),
    subject: z.string().max(100),
    startedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    backHref: z.string().max(2000).optional(),
    learningContext: z.object({ workspaceId: z.string().uuid(), activityId: z.string().uuid() }).optional(),
  })).max(200),
  olympiad: z.record(z.string(), examContextSchema).optional(),
  variants: z.record(z.string(), z.string()),
});
export type StudyHistory = z.infer<typeof historySchema>;
export type StudyStatus = "not-started" | "in-progress" | "evaluated";

function key(userId = readBrowserStorage(ACTIVE_PROGRESS_USER_KEY)) {
  return `${prefix}:${userId ?? "guest"}`;
}
export function studySnapshot() {
  return readBrowserStorage(key());
}
export function parseStudyHistory(raw: string | null): StudyHistory {
  try {
    return historySchema.parse(JSON.parse(raw ?? "null"));
  } catch {
    return { sessions: [], variants: {} };
  }
}
function save(history: StudyHistory, storageKey = key()) {
  writeBrowserStorage(storageKey, JSON.stringify(history));
  window.dispatchEvent(new Event(STUDY_HISTORY_EVENT));
}
export function subscribeStudyHistory(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STUDY_HISTORY_EVENT, callback);
  window.addEventListener("iabacu:attempts-updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STUDY_HISTORY_EVENT, callback);
    window.removeEventListener("iabacu:attempts-updated", callback);
  };
}
export function activateStudyUser(userId: string) {
  const guest = parseStudyHistory(readBrowserStorage(key(null)));
  const account = parseStudyHistory(readBrowserStorage(key(userId)));
  const sessions = new Map<string, StudyHistory["sessions"][number]>();
  for (const session of [...account.sessions, ...guest.sessions]) {
    const previous = sessions.get(session.examId);
    if (!previous || session.updatedAt > previous.updatedAt) sessions.set(session.examId, session);
  }
  save({
    sessions: [...sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 200),
    variants: { ...guest.variants, ...account.variants },
    ...((guest.olympiad || account.olympiad) ? { olympiad: { ...guest.olympiad, ...account.olympiad } } : {}),
  }, key(userId));
  save({ sessions: [], variants: {} }, key(null));
}
export function rememberVariant(subject: string, variant: string) {
  const history = parseStudyHistory(studySnapshot());
  if (history.variants[subject] === variant) return;
  save({ ...history, variants: { ...history.variants, [subject]: variant } });
}
export function studyAttempts(): AttemptRecord[] {
  try { return loadAttempts(); } catch { return []; }
}
export function resumeStudyHref(session: StudyHistory["sessions"][number]) {
  const params = new URLSearchParams();
  if (session.backHref) params.set("from", safeReturnPath(session.backHref, "/"));
  if (session.learningContext) {
    params.set("learningWorkspace", session.learningContext.workspaceId);
    params.set("learningActivity", session.learningContext.activityId);
  }
  return `/exam/${encodeURIComponent(session.examId)}${params.size ? `?${params}` : ""}`;
}
export function startStudy(exam: Exam, attempts: AttemptRecord[], now = new Date().toISOString(), context?: {
  backHref?: string;
  learningContext?: { workspaceId: string; activityId: string };
}) {
  const history = parseStudyHistory(studySnapshot());
  const previous = history.sessions.find((session) => session.examId === exam.id);
  const continuing = studyStatus(exam.id, history, attempts) === "in-progress";
  save({
    ...history,
    sessions: [{
      examId: exam.id, title: exam.title, subject: exam.subject,
      startedAt: continuing && previous ? previous.startedAt : now,
      updatedAt: now,
      backHref: context?.backHref ?? previous?.backHref,
      learningContext: context?.learningContext ?? previous?.learningContext,
    }, ...history.sessions.filter((session) => session.examId !== exam.id)].slice(0, 200),
  });
  if (exam.category === "olympiad") rememberOlympiadContext(exam.olympiadSubject ?? exam.subject, { grade: exam.olympiadGrade, stage: exam.olympiadStage });
  const variants = getExamVariants(exam);
  if ((exam.category ?? "bac") === "bac" && variants.length === 1) rememberVariant(exam.subject, variants[0]);
}
export function studyStatus(examId: string, history: StudyHistory, attempts: AttemptRecord[]): StudyStatus {
  const session = history.sessions.find((item) => item.examId === examId);
  const latest = attempts.filter((attempt) => attempt.examId === examId)
    .reduce((time, attempt) => Math.max(time, Date.parse(attempt.createdAt)), 0);
  if (session && Date.parse(session.startedAt) > latest) return "in-progress";
  return latest ? "evaluated" : session ? "in-progress" : "not-started";
}

export function rememberOlympiadContext(subject: string, context: ExamContext) {
  const history = parseStudyHistory(studySnapshot());
  if (JSON.stringify(history.olympiad?.[subject]) === JSON.stringify(context)) return;
  save({ ...history, olympiad: { ...history.olympiad, [subject]: context } });
}
