import Link from "next/link";
import { practiceTopics } from "@/lib/practice-topics";
import { createPageMetadata } from "@/lib/seo";
export const metadata = createPageMetadata({ title: "Exerciții pe teme · Matematică Mate-Info", description: "Seturi scurte din modelele oficiale de Bacalaureat, cu enunțuri și bareme.", path: "/matematica/exerseaza" });
export default function PracticeTopicsPage() {
  return <main className="min-h-screen bg-[#f7f8f5] px-4 py-10"><div className="mx-auto max-w-4xl">
    <Link href="/matematica" className="text-sm font-medium text-emerald-800">← Arhiva de matematică</Link>
    <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-emerald-800">Bacalaureat · Mate-Info</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Exersează o temă</h1>
    <p className="mt-3 max-w-2xl leading-7 text-zinc-600">Trei exerciții oficiale, apoi verificarea pașilor. Colecția cuprinde 12 exerciții din Subiectul I al modelelor 2024–2026.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">{practiceTopics.map((topic) => <Link key={topic.id} href={`/matematica/exerseaza/${topic.id}`} className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-emerald-500"><h2 className="text-lg font-semibold">{topic.title}</h2><p className="mt-2 text-sm text-zinc-600">3 exerciții · 15 puncte · aproximativ 15 minute</p><p className="mt-5 text-sm font-semibold text-emerald-800">Începe setul →</p></Link>)}</div>
  </div></main>;
}
