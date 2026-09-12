"use client";

import { useState } from "react";
import Link from "next/link";
import { saveAttemptRecord, loadAttempts, ATTEMPTS_UPDATED_EVENT } from "@/lib/attempts";
import { useEffect } from "react";
import type { AttemptRecord, Exam } from "@/lib/schemas";
import { formatScore } from "@/lib/score";

export function ExamSelfAssessment({ exam, baremHref, simulation, elapsedSeconds }: {
  exam: Exam; baremHref?: string; simulation: boolean; elapsedSeconds: number;
}) {
  const [score, setScore] = useState("");
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => { try { setAttempts(loadAttempts().filter((attempt) => attempt.examId === exam.id)); } catch { setAttempts([]); } };
    refresh();
    window.addEventListener(ATTEMPTS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(ATTEMPTS_UPDATED_EVENT, refresh);
  }, [exam.id]);
  function save(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(score.replace(",", "."));
    if (!score.trim() || !Number.isFinite(value) || value < 1 || value > 10) {
      setError("Introdu o notă între 1 și 10."); return;
    }
    try {
      saveAttemptRecord({ id: crypto.randomUUID(), examId: exam.id, score: Math.round(value * 100) / 100,
        createdAt: new Date().toISOString(), source: "self", mode: simulation ? "simulation" : "practice", elapsedSeconds });
      setScore(""); setError(null); setMessage("Autoevaluarea a fost salvată.");
    } catch { setError("Rezultatul nu a putut fi salvat în acest browser."); }
  }
  return <section className="border-b border-zinc-200 p-4" aria-label="Autoevaluare și istoric">
    <details>
      <summary className="min-h-10 cursor-pointer text-sm font-semibold">Autoevaluare și istoric{attempts.length ? ` (${attempts.length})` : ""}</summary>
      <p className="mt-2 text-sm leading-6 text-zinc-600">Compară lucrarea cu <Link className="font-medium text-emerald-800 underline" href={baremHref ?? `/exam/${exam.id}/barem`}>baremul oficial</Link> și păstrează nota. Poți lucra fără AI sau cont.</p>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">Nota ta<input aria-label="Nota ta" inputMode="decimal" value={score} onChange={(event) => { setScore(event.target.value); setMessage(null); }} placeholder="1–10" className="min-h-11 w-24 rounded-lg border border-zinc-300 px-3" /></label>
        <button className="min-h-11 rounded-lg bg-emerald-800 px-3 text-sm font-semibold text-white" type="submit" disabled={!score.trim()}>Salvează nota</button>
      </form>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p role="status" className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {attempts.length ? <ol className="mt-4 grid max-h-64 gap-2 overflow-auto">{attempts.map((attempt) => <li key={attempt.id} className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
        <span className="text-sm font-semibold text-zinc-950">{formatScore(attempt.score)}</span> · {attempt.source === "self" ? "Autoevaluare" : attempt.source === "adjusted" ? "AI · ajustat de tine" : "Evaluare AI"}
        <p className="mt-1">{new Date(attempt.createdAt).toLocaleString("ro-RO")} {attempt.mode === "simulation" ? "· Simulare" : ""}{attempt.elapsedSeconds != null ? ` · ${Math.ceil(attempt.elapsedSeconds / 60)} min` : ""}</p>
      </li>)}</ol> : null}
    </details>
  </section>;
}
