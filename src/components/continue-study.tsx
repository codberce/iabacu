"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { resumeStudyHref, studyAttempts, studyStatus, subscribeStudyHistory } from "@/lib/study-history";
import type { AttemptRecord } from "@/lib/schemas";
import { useStudyHistory } from "@/components/use-study-history";

const subjectLabels: Record<string, string> = {
  romana: "Română", matematica: "Matematică", fizica: "Fizică", informatica: "Informatică",
  chimie: "Chimie", biologie: "Biologie", istorie: "Istorie", geografie: "Geografie",
  logica: "Logică", psihologie: "Psihologie", sociologie: "Sociologie", economie: "Economie", filosofie: "Filosofie",
};

export function ContinueStudy() {
  const history = useStudyHistory();
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  useEffect(() => {
    const refresh = () => setAttempts(studyAttempts());
    refresh();
    return subscribeStudyHistory(refresh);
  }, []);
  const current = history.sessions.find((session) => studyStatus(session.examId, history, attempts) === "in-progress");
  if (!current) return null;
  return (
    <section aria-label="Continuă lucrul" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-white p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-emerald-800">În lucru · pe acest dispozitiv</p>
        <p className="mt-1 font-semibold text-zinc-950">{subjectLabels[current.subject] ?? current.subject} · {current.title}</p>
      </div>
      <Link href={resumeStudyHref(current)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900">
        Continuă <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
