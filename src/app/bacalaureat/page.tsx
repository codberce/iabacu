import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { bacExams, bacYears } from "@/lib/exams";
import {
  absoluteUrl,
  createPageMetadata,
  siteName,
  siteUrl,
} from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Arhiva bac: subiecte și bareme",
  description: "Alege anul și găsește rapid subiectele și baremele de bacalaureat, organizate pe materii și sesiuni.",
  path: "/bacalaureat",
  keywords: ["subiecte bacalaureat", "bareme bac", "arhiva bacalaureat", "subiecte bac pe ani"],
});

export default function BacalaureatPage() {
  const years = bacYears.map((year) => {
    const exams = bacExams.filter((exam) => exam.year === year);
    return {
      year,
      examCount: exams.length,
      subjectCount: new Set(exams.map((exam) => exam.subject)).size,
    };
  });
  const [currentYear, ...previousYears] = years;

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            name: "Arhivă bacalaureat",
            description: "Subiecte și bareme de bacalaureat organizate pe ani.",
            url: absoluteUrl("/bacalaureat"),
            isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: years.length,
              itemListElement: years.map(({ year }, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: `Bacalaureat ${year}`,
                url: absoluteUrl(`/bacalaureat/${year}`),
              })),
            },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Acasă", item: siteUrl },
              { "@type": "ListItem", position: 2, name: "Bacalaureat", item: absoluteUrl("/bacalaureat") },
            ],
          },
        ],
      }} />
      <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          <header className="border-b border-zinc-200/80 pb-7">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Bacalaureat
            </h1>
          </header>

          <section className="py-8" aria-labelledby="bac-current-title">
            {currentYear ? (
              <Link
                href={`/bacalaureat/${currentYear.year}`}
                className="group grid gap-5 border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-7"
              >
                <span>
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Cel mai recent
                  </span>
                  <h2 id="bac-current-title" className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                    {currentYear.year}
                  </h2>
                  <span className="mt-2 block text-sm text-emerald-900/70">
                    {currentYear.subjectCount} materii · {currentYear.examCount} variante
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            ) : null}

            <div className="mt-9 flex items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                Ani anteriori
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {previousYears.map(({ year, examCount }) => (
                <Link
                  key={year}
                  href={`/bacalaureat/${year}`}
                  className="group flex min-h-28 flex-col justify-between border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:min-h-32"
                >
                  <span className="flex items-start justify-end">
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-2xl font-semibold tracking-[-0.03em]">{year}</span>
                    <span className="mt-0.5 block text-xs text-current/60">
                      {examCount} variante
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
