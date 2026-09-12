"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useStudyHistory } from "@/components/use-study-history";
import { rememberOlympiadContext } from "@/lib/study-history";
import { examContextLabel, type ExamContext } from "@/lib/study-exam-context";
import { getOlympiadSubject } from "@/lib/olympiad-subjects";
export function RememberOlympiad({ subject, grade, stage }: { subject: string; grade?: number; stage?: ExamContext["stage"] }) {
  useEffect(() => { if (grade) rememberOlympiadContext(subject, { grade, stage }); }, [subject, grade, stage]);
  return null;
}
export function ContinueOlympiad({ subject }: { subject: string }) {
  const history = useStudyHistory();
  const context = history.olympiad?.[subject];
  const path = getOlympiadSubject(subject)?.path;
  if (!context?.grade || !path) return null;
  const params = new URLSearchParams({ clasa: String(context.grade) });
  if (context.stage) params.set("etapa", context.stage);
  return <Link href={`${path}?${params}`} className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800">Continuă · {examContextLabel(context)} →</Link>;
}
