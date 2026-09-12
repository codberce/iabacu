import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_PROGRESS_USER_KEY } from "@/lib/attempts";
import { activateStudyUser, parseStudyHistory, rememberVariant, resumeStudyHref, startStudy, studyAttempts, studySnapshot, studyStatus } from "./study-history";
import type { AttemptRecord, Exam } from "./schemas";

const exam = { id: "exam-1", title: "Model 2026", category: "bac", subject: "matematica", profile: "M_mate-info" } as Exam;
const attempt = { examId: exam.id, createdAt: "2026-09-12T10:30:00.000Z" } as AttemptRecord;
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});

describe("study history", () => {
  it("distinguishes unfinished work, assessment, and a later retry", () => {
    expect(studyStatus(exam.id, parseStudyHistory(studySnapshot()), [])).toBe("not-started");
    startStudy(exam, [], "2026-09-12T10:00:00.000Z");
    expect(studyStatus(exam.id, parseStudyHistory(studySnapshot()), [])).toBe("in-progress");
    // Resuming a timer preserves the original attempt boundary.
    startStudy(exam, [], "2026-09-12T10:20:00.000Z");
    expect(parseStudyHistory(studySnapshot()).sessions[0].startedAt).toBe("2026-09-12T10:00:00.000Z");
    expect(studyStatus(exam.id, parseStudyHistory(studySnapshot()), [attempt])).toBe("evaluated");
    startStudy(exam, [attempt], "2026-09-12T11:00:00.000Z");
    expect(studyStatus(exam.id, parseStudyHistory(studySnapshot()), [attempt])).toBe("in-progress");
  });

  it("transfers guest work only to the account signing in and keeps other accounts separate", () => {
    startStudy(exam, []);
    activateStudyUser("student-1");
    localStorage.setItem(ACTIVE_PROGRESS_USER_KEY, "student-1");
    expect(parseStudyHistory(studySnapshot()).sessions).toHaveLength(1);
    expect(parseStudyHistory(studySnapshot()).variants.matematica).toBe("Mate-Info");
    activateStudyUser("student-2");
    localStorage.setItem(ACTIVE_PROGRESS_USER_KEY, "student-2");
    expect(parseStudyHistory(studySnapshot()).sessions).toHaveLength(0);
  });

  it("resumes an assigned exam with its original learning activity and return path", () => {
    const context = { workspaceId: "018f47d2-735b-7b52-8de1-f2f83ac26a12", activityId: "018f47d2-735b-7b52-8de1-f2f83ac26a13" };
    startStudy(exam, [], undefined, { backHref: `/invata/${context.workspaceId}`, learningContext: context });
    const href = new URL(resumeStudyHref(parseStudyHistory(studySnapshot()).sessions[0]), "https://iabacu.ro");
    expect(href.searchParams.get("learningActivity")).toBe(context.activityId);
    expect(href.searchParams.get("from")).toBe(`/invata/${context.workspaceId}`);
  });

  it("handles malformed or unavailable storage without breaking practice", () => {
    expect(parseStudyHistory("{broken")).toEqual({ sessions: [], variants: {} });
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(studyAttempts()).toEqual([]);
    expect(() => startStudy(exam, [])).not.toThrow();
    expect(() => rememberVariant("matematica", "Mate-Info")).not.toThrow();
  });
});
