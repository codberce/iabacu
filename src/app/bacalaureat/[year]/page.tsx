import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { subjects as subjectCards } from "@/components/subject-picker";
import { bacExams, bacYears } from "@/lib/exams";
import {
  absoluteUrl,
  createPageMetadata,
  siteName,
  siteUrl,
  subjectSeo,
} from "@/lib/seo";

type BacYearPageProps = { params: Promise<{ year: string }> };

function parseYear(value: string) {
  const year = Number(value);
  return Number.isInteger(year) && bacYears.includes(year) ? year : undefined;
}

export function generateStaticParams() {
  return bacYears.map((year) => ({ year: String(year) }));
}

export async function generateMetadata({ params }: BacYearPageProps): Promise<Metadata> {
  const year = parseYear((await params).year);
  if (!year) return {};
  return createPageMetadata({
    title: `Bac ${year}: subiecte și bareme`,
    description: `Subiectele și baremele de bacalaureat din ${year}, organizate pe materii, sesiuni și profiluri. Deschide PDF-urile direct în browser.`,
    path: `/bacalaureat/${year}`,
    keywords: [`subiecte bac ${year}`, `bareme bac ${year}`, `bacalaureat ${year}`],
  });
}

export default async function BacYearPage({ params }: BacYearPageProps) {
  const year = parseYear((await params).year);
  if (!year) notFound();
  const yearExams = bacExams.filter((exam) => exam.year === year);
  const subjects = Object.entries(subjectSeo)
    .map(([slug, seo]) => {
      const subjectCard = subjectCards.find((subject) => subject.id === slug);

      return {
        slug,
        seo,
        accent: subjectCard?.accent ?? "border-zinc-200 bg-white text-zinc-950",
        exams: yearExams.filter((exam) => exam.subject === slug),
      };
    })
    .filter((item) => item.exams.length > 0);

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            name: `Subiecte bac ${year} și bareme`,
            description: `Arhiva bacalaureat ${year} pe materii și sesiuni.`,
            url: absoluteUrl(`/bacalaureat/${year}`),
            isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: subjects.length,
              itemListElement: subjects.map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: `Subiecte bac ${item.seo.name} ${year}`,
                url: absoluteUrl(`/${item.slug}?year=${year}`),
              })),
            },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Acasă", item: siteUrl },
              { "@type": "ListItem", position: 2, name: "Bacalaureat", item: absoluteUrl("/bacalaureat") },
              { "@type": "ListItem", position: 3, name: String(year), item: absoluteUrl(`/bacalaureat/${year}`) },
            ],
          },
        ],
      }} />
      <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          <header className="border-b border-zinc-200 pb-7">
            <Link href="/bacalaureat" className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 hover:text-emerald-950">
              Bacalaureat
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-4xl">
              {year}
            </h1>
          </header>

          <section className="py-8" aria-labelledby="bac-subjects-title">
            <h2 id="bac-subjects-title" className="text-2xl font-semibold tracking-[-0.03em]">Materii</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {subjects.map(({ slug, seo, exams, accent }) => (
                <Link key={slug} href={`/${slug}?year=${year}`} className={`group border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent}`}>
                  <span className="text-lg font-semibold">{seo.shortName}</span>
                  <span className="mt-2 block text-sm leading-6 text-current/70">{exams.length} variante</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
