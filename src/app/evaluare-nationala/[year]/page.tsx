import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nationalEvaluationExams, nationalEvaluationYears } from "@/lib/exams";
import { createPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ year: string }> };
function parseYear(value: string) { const year = Number(value); return nationalEvaluationYears.includes(year) ? year : undefined; }
export function generateStaticParams() { return nationalEvaluationYears.map((year) => ({ year: String(year) })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const year = parseYear((await params).year); if (!year) return {};
  return createPageMetadata({ title: `Evaluarea Națională ${year}: subiecte și bareme`, description: `Subiecte și bareme ${year} pentru clasa a VIII-a, la Română și Matematică.`, path: `/evaluare-nationala/${year}`, keywords: [`evaluarea nationala ${year}`, `subiecte clasa a 8-a ${year}`] });
}
export default async function NationalEvaluationYearPage({ params }: Props) {
  const year = parseYear((await params).year); if (!year) notFound();
  const counts = Object.fromEntries(["romana", "matematica"].map((subject) => [subject, nationalEvaluationExams.filter((exam) => exam.year === year && exam.subject === subject).length]));
  return <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950"><div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8"><header className="border-b border-zinc-200 pb-7"><Link href="/evaluare-nationala" className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Evaluarea Națională</Link><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{year}</h1></header><section className="py-8"><h2 className="text-2xl font-semibold tracking-[-0.03em]">Materii</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{[{ slug: "romana", name: "Limba și literatura română", accent: "border-rose-300 bg-rose-50 text-rose-950" }, { slug: "matematica", name: "Matematică", accent: "border-emerald-300 bg-emerald-50 text-emerald-950" }].map((item) => <Link key={item.slug} href={`/evaluare-nationala/${item.slug}?year=${year}`} className={`group border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.accent}`}><span className="text-lg font-semibold">{item.name}</span><span className="mt-2 block text-sm text-current/70">{counts[item.slug]} variante</span></Link>)}</div></section></div></main>;
}
