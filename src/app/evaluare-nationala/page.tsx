import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { nationalEvaluationExams, nationalEvaluationYears } from "@/lib/exams";
import { absoluteUrl, createPageMetadata, siteName, siteUrl } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Evaluarea Națională: subiecte și bareme",
  description: "Subiecte și bareme pentru Evaluarea Națională, clasa a VIII-a, la Română și Matematică.",
  path: "/evaluare-nationala",
  keywords: ["evaluarea nationala", "subiecte evaluare nationala", "bareme clasa a 8-a"],
});

export default function NationalEvaluationPage() {
  const years = nationalEvaluationYears.map((year) => ({
    year,
    examCount: nationalEvaluationExams.filter((exam) => exam.year === year).length,
  }));
  const [currentYear, ...previousYears] = years;
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Evaluarea Națională", url: absoluteUrl("/evaluare-nationala"), isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl } }} />
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="border-b border-zinc-200/80 pb-7">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Evaluarea Națională</h1>
        </header>
        <section className="py-8" aria-labelledby="en-current-title">
          {currentYear && <Link href={`/evaluare-nationala/${currentYear.year}`} className="group grid gap-5 border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-7">
            <span><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800"><CalendarDays className="h-4 w-4" />Cel mai recent</span><h2 id="en-current-title" className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{currentYear.year}</h2><span className="mt-2 block text-sm text-emerald-900/70">{currentYear.examCount} variante</span></span><ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </Link>}
          <h2 className="mt-9 text-2xl font-semibold tracking-[-0.03em]">Ani anteriori</h2>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {previousYears.map(({ year, examCount }) => <Link key={year} href={`/evaluare-nationala/${year}`} className="group flex min-h-28 flex-col justify-between border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-32"><ArrowRight className="ml-auto h-4 w-4 opacity-50" /><span><span className="block text-2xl font-semibold">{year}</span><span className="text-xs text-zinc-500">{examCount} variante</span></span></Link>)}
          </div>
        </section>
      </div>
    </main>
  </>;
}
