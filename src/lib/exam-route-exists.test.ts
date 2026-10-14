import { describe, expect, it } from "vitest";
import { examAliases, exams } from "./exams";
import { isKnownExamRoute } from "./exam-route-exists";
import examIds from "@/data/exam-route-ids.json";

describe("public exam route validation", () => {
  it("keeps the lightweight routing index complete and current", () => {
    expect(examIds).toEqual([...new Set([...exams.map((exam) => exam.id), ...Object.keys(examAliases)])].toSorted());
  });

  it.each(["/exam/bac-2026-model-model-oficial", "/exam/archive-logica-143/barem", "/exam/archive-logica-872", "/exam/olympiad%3A5%3Alegacy-document"])("accepts canonical, alias and legacy document routes: %s", (path) => {
    expect(isKnownExamRoute(path)).toBe(true);
  });

  it.each(["/exam/unknown", "/exam/bac-2099-final-missing/barem", "/exam/%invalid"])("rejects unknown IDs before streaming starts: %s", (path) => {
    expect(isKnownExamRoute(path)).toBe(false);
  });

  it.each(["/matematica", "/api/learning/workspaces/private", "/exam/extra/path"])("does not handle other routes: %s", (path) => {
    expect(isKnownExamRoute(path)).toBeNull();
  });
});
