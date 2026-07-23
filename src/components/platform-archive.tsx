import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Trophy,
} from "lucide-react";
import {
  getOlympiadGradesForSubject,
  getPlatformArchive,
  olympiadSessionLabels,
  platformArchivePath,
  PLATFORM_ARCHIVE_PAGE_SIZE,
  type OlympiadGrade,
  type OlympiadStageSlug,
} from "@/lib/competitions";
import { getOlympiadSubject, type OlympiadSubjectId } from "@/lib/olympiad-subjects";
import { withReturnPath } from "@/lib/return-path";
import { absoluteUrl, siteName, siteUrl } from "@/lib/seo";
import type { Exam } from "@/lib/schemas";

const stageLabelMap: Record<OlympiadStageSlug, string> = {
  locala: "Locală",
  judeteana: "Județeană",
  nationala: "Națională",
};

const gradeAccents = [
  "border-rose-200 bg-rose-50 text-rose-950",
  "border-orange-200 bg-orange-50 text-orange-950",
  "border-amber-200 bg-amber-50 text-amber-950",
  "border-lime-200 bg-lime-50 text-lime-950",
  "border-emerald-200 bg-emerald-50 text-emerald-950",
  "border-cyan-200 bg-cyan-50 text-cyan-950",
  "border-sky-200 bg-sky-50 text-sky-950",
  "border-violet-200 bg-violet-50 text-violet-950",
] as const;

type PlatformArchiveProps = {
  olympiadSubject: OlympiadSubjectId;
  grade: OlympiadGrade;
  stage?: string;
  year?: string;
  q?: string;
  page?: string;
};

export function PlatformArchive({
  olympiadSubject,
  grade,
  stage,
  year,
  q,
  page,
}: PlatformArchiveProps) {
  const subject = getOlympiadSubject(olympiadSubject);
  if (!subject || subject.mode !== "platform") {
    return null;
  }
  const archive = getPlatformArchive({
    olympiadSubject,
    grade,
    stage,
    year,
    q,
    page,
  });
  const grades = getOlympiadGradesForSubject(olympiadSubject);
  const title = `${subject.olympiadName} · Clasa a ${grade}-a`;
  const canonicalPath = platformArchivePath({
    olympiadSubject,
    grade,
    stage: "all",
    year: "all",
    q: "",
    page: 1,
  });
  const pagePath = platformArchivePath({
    olympiadSubject,
    grade,
    stage: archive.filters.stage,
    year: archive.filters.year,
    q: archive.filters.q,
    page: archive.page,
  });
  const previousHref = archive.hasPrevious
    ? platformArchivePath({
        olympiadSubject,
        grade,
        stage: archive.filters.stage,
        year: archive.filters.year,
        q: archive.filters.q,
        page: archive.page - 1,
      })
    : null;
  const nextHref = archive.hasNext
    ? platformArchivePath({
        olympiadSubject,
        grade,
        stage: archive.filters.stage,
        year: archive.filters.year,
        q: archive.filters.q,
        page: archive.page + 1,
      })
    : null;

  return (
    <>
      <PlatformArchiveJsonLd
        pagePath={pagePath}
        title={title}
        archive={archive}
      />
      <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6">
            <Link
              href="/olimpiade"
              className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 hover:text-emerald-950"
            >
              Olimpiade
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 sm:text-base">
                Probe publicate pe {subject.platformName}, organizate pe ani și etape. Pagina afișează cel mult {PLATFORM_ARCHIVE_PAGE_SIZE} de probe.
              </p>
            </div>
            <nav aria-label="Clase" className="flex flex-wrap gap-2 pb-1">
              {grades
                .filter((item) => item !== grade)
                .map((item, index) => (
                  <Link
                    key={item}
                    href={platformArchivePath({
                      olympiadSubject,
                      grade: item,
                      stage: "all",
                      year: "all",
                      q: "",
                      page: 1,
                    })}
                    className={`inline-flex min-h-9 items-center justify-center border px-3 text-xs font-semibold opacity-55 transition hover:opacity-90 ${gradeAccents[index % gradeAccents.length]}`}
                  >
                    Clasa a {item}-a
                  </Link>
                ))}
            </nav>
          </header>

          <form
            method="get"
            action={canonicalPath}
            className="grid gap-3 border border-zinc-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end"
            aria-label="Filtrează probele"
          >
            <input type="hidden" name="clasa" value={grade} />
            <label className="flex min-h-11 flex-col gap-1 text-xs font-semibold text-zinc-600">
              <span className="sr-only">Caută</span>
              <span className="flex min-h-11 items-center gap-2 border border-zinc-300 bg-white px-3 focus-within:ring-2 focus-within:ring-zinc-900">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  type="search"
                  name="q"
                  defaultValue={archive.filters.q}
                  placeholder="Titlu, an sau etapă"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </span>
            </label>
            <label className="flex min-h-11 flex-col gap-1 text-xs font-semibold text-zinc-600">
              <span className="sr-only">An</span>
              <span className="flex min-h-11 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm">
                <CalendarDays className="h-4 w-4 shrink-0 text-zinc-500" />
                <select
                  name="an"
                  defaultValue={archive.filters.year === "all" ? "all" : String(archive.filters.year)}
                  className="w-full bg-transparent outline-none sm:w-28"
                >
                  <option value="all">Toți anii</option>
                  {archive.years.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="flex min-h-11 flex-col gap-1 text-xs font-semibold text-zinc-600">
              <span className="sr-only">Etapă</span>
              <span className="flex min-h-11 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-zinc-500" />
                <select
                  name="etapa"
                  defaultValue={archive.filters.stage}
                  className="w-full bg-transparent outline-none sm:w-36"
                >
                  <option value="all">Toate etapele</option>
                  {archive.stages.map((slug) => (
                    <option key={slug} value={slug}>
                      {stageLabelMap[slug]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Filtrează
            </button>
          </form>

          <p className="text-sm text-zinc-600" aria-live="polite">
            {archive.total === 0
              ? "Nu există probe pentru filtrele alese."
              : `Se afișează ${archive.startIndex}–${archive.endIndex} din ${archive.total} de probe (pagina ${archive.page} din ${archive.totalPages}).`}
          </p>

          {archive.exams.length === 0 ? (
            <section className="border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-700">
              {`Nu există probe pentru clasa a ${grade}-a cu filtrele alese.`}
            </section>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {archive.exams.map((exam, index) => (
                <li
                  key={exam.id}
                  aria-posinset={archive.startIndex + index}
                  aria-setsize={archive.total}
                >
                  <PlatformTaskCard
                    exam={exam}
                    position={archive.startIndex + index}
                    returnPath={pagePath}
                  />
                </li>
              ))}
            </ul>
          )}

          <nav
            aria-label="Paginare"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4"
          >
            <div className="text-sm text-zinc-600">
              Pagina {archive.page} din {archive.totalPages}
            </div>
            <div className="flex items-center gap-2">
              {previousHref ? (
                <Link
                  href={previousHref}
                  rel="prev"
                  aria-label={`Pagina anterioară (${archive.page - 1})`}
                  className="inline-flex min-h-10 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-semibold transition hover:border-zinc-950"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Înapoi
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex min-h-10 items-center gap-2 border border-zinc-200 bg-zinc-100 px-3 text-sm font-semibold text-zinc-400"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Înapoi
                </span>
              )}
              {nextHref ? (
                <Link
                  href={nextHref}
                  rel="next"
                  aria-label={`Pagina următoare (${archive.page + 1})`}
                  className="inline-flex min-h-10 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-semibold transition hover:border-zinc-950"
                >
                  Înainte
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex min-h-10 items-center gap-2 border border-zinc-200 bg-zinc-100 px-3 text-sm font-semibold text-zinc-400"
                >
                  Înainte
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </div>
          </nav>
        </div>
      </main>
    </>
  );
}

function PlatformTaskCard({
  exam,
  position,
  returnPath,
}: {
  exam: Exam;
  position: number;
  returnPath: string;
}) {
  const platform = exam.platform;
  const stageLabel = olympiadSessionLabels[exam.sessionType] ?? exam.sessionLabel;
  const examHref = withReturnPath(`/exam/${exam.id}`, returnPath);
  return (
    <article
      className="group flex min-h-28 flex-col justify-between border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md sm:min-h-36"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6 sm:text-lg">
            {exam.sessionLabel}
          </h2>
          <span className="mt-1 flex items-center gap-1.5 text-sm opacity-80">
            <Trophy className="h-4 w-4 shrink-0" />
            <span className="truncate">{stageLabel} · {exam.year}</span>
          </span>
        </div>
        <span className="text-xs font-semibold text-zinc-500">#{position}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Link
          href={examHref}
          className="inline-flex min-h-9 items-center gap-1.5 bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800"
        >
          Deschide proba
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {platform ? (
          <a
            href={platform.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Deschide ${exam.sessionLabel} pe platforma sursă`}
            className="inline-flex min-h-9 items-center gap-1.5 border border-zinc-300 bg-white px-3 text-xs font-semibold transition hover:border-zinc-950"
          >
            Sursa
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function PlatformArchiveJsonLd({
  pagePath,
  title,
  archive,
}: {
  pagePath: string;
  title: string;
  archive: ReturnType<typeof getPlatformArchive>;
}) {
  if (archive.exams.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    url: absoluteUrl(pagePath),
    isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: archive.exams.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: archive.exams.map((exam, index) => ({
        "@type": "ListItem",
        position: archive.startIndex + index,
        name: exam.title,
        url: absoluteUrl(`/exam/${exam.id}`),
      })),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
