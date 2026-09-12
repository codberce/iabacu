"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AiMessage } from "@/components/ai-message";
import { readBrowserStorage, writeBrowserStorage } from "@/lib/safe-browser-storage";
import type { CuratedExercise, PracticeTopic } from "@/lib/practice-topics";
const draftSchema = z.record(z.string(), z.object({ answer: z.string().max(16000), revealed: z.boolean(), helpViewed: z.boolean().optional(), result: z.enum(["correct", "retry"]).optional() }));
type Drafts = z.infer<typeof draftSchema>;
type PracticeSetProps = { topic: { id: PracticeTopic; title: string }; exercises: CuratedExercise[] };
export function PracticeSet({ topic, exercises }: PracticeSetProps) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [readyKey, setReadyKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const storageKey = `iabacu:practice-set:guest:${topic.id}`;
  useEffect(() => {
    let draft: Drafts = {};
    try { draft = draftSchema.parse(JSON.parse(readBrowserStorage(storageKey) ?? "{}")); } catch { /* Ignore invalid drafts. */ }
    // Restore this browser draft after hydration and account changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts(draft); setReadyKey(storageKey);
  }, [storageKey]);
  const ready = readyKey === storageKey;
  function update(id: string, patch: Partial<Drafts[string]>) {
    if (patch.revealed) patch = { ...patch, helpViewed: true };
    const next = { ...drafts, [id]: { ...(drafts[id] ?? { answer: "", revealed: false }), ...patch } };
    setDrafts(next);
    if (!writeBrowserStorage(storageKey, JSON.stringify(next))) setError("Browserul nu permite salvarea locală. Păstrează o copie a rezolvării înainte să închizi pagina.");
  }
  const reviewed = ready ? exercises.filter((exercise) => drafts[exercise.id]?.result).length : 0;
  return <main className="min-h-screen bg-[#f7f8f5] px-4 py-8"><div className="mx-auto max-w-3xl">
    <Link href="/matematica/exerseaza" className="text-sm font-medium text-emerald-800">← Toate temele</Link>
    <p className="mt-7 text-xs font-semibold uppercase tracking-widest text-emerald-800">Bacalaureat · Mate-Info</p><h1 className="mt-2 text-3xl font-semibold">{topic.title}</h1>
    <p className="mt-3 leading-7 text-zinc-600">Lucrează pe hârtie sau scrie mai jos. Verifică fiecare rezolvare cu baremul înainte să treci mai departe.</p>
    <p role="status" className="mt-3 text-sm text-zinc-600">{reviewed} din 3 exerciții autoevaluate · răspunsurile se păstrează în acest browser</p>
    <div className="mt-7 grid gap-5">{exercises.map((exercise, index) => {
      const draft = ready ? drafts[exercise.id] : undefined;
      return <article key={exercise.id} className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Exercițiul {index + 1}</h2><p className="mt-1 text-xs text-zinc-500">Model oficial {exercise.year} · {exercise.reference} · 5 puncte</p>
        <div className="mt-4 text-sm leading-7"><AiMessage content={exercise.statement} /></div>
        <label className="mt-5 block text-sm font-medium">Rezolvarea exercițiului {index + 1}<textarea disabled={!ready} value={draft?.answer ?? ""} onChange={(event) => update(exercise.id, { answer: event.target.value, result: undefined })} rows={4} maxLength={16000} className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal" /></label>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm"><button disabled={!ready} type="button" onClick={() => update(exercise.id, { revealed: !draft?.revealed })} className="min-h-11 rounded-lg border border-zinc-300 px-3 font-semibold">{draft?.revealed ? "Ascunde baremul" : "Verifică după barem"}</button><Link href={`/exam/${exercise.examId}`} className="font-medium text-emerald-800 underline">Subiectul complet</Link><Link href={`/exam/${exercise.examId}/barem`} className="font-medium text-emerald-800 underline">Baremul oficial</Link></div>
        {draft?.revealed ? <div className="mt-4 rounded-xl bg-emerald-50/60 p-4 text-sm leading-7"><AiMessage content={exercise.rubric} /><p className="mt-2 text-xs text-zinc-600">Se punctează și alte soluții corecte, conform baremului oficial.</p><div className="mt-3 flex flex-wrap gap-2">{([['correct', 'Am rezolvat corect'], ['retry', 'Mai exersez']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={draft.result === value} onClick={() => update(exercise.id, { result: value })} className={`min-h-11 rounded-lg border px-3 font-medium ${draft.result === value ? "border-emerald-800 bg-emerald-800 text-white" : "border-zinc-300 bg-white"}`}>{label}</button>)}</div></div> : null}
      </article>;
    })}</div>
    {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}

  </div></main>;
}
