import Link from "next/link";
import { ArrowRight, MapPin, Trophy } from "lucide-react";
import {
  olympiadCounties,
  olympiadCountySlug,
  getOlympiadDocuments,
  getOlympiadWorkspaces,
  getOlympiadYearsForSubject,
  type OlympiadGrade,
  type OlympiadStageSlug,
} from "@/lib/competitions";

type CompetitionArchiveProps = {
  stage: OlympiadStageSlug;
  stageName: string;
  grade: OlympiadGrade;
};

export function CompetitionArchive({
  stage,
  stageName,
  grade,
}: CompetitionArchiveProps) {
  const isLocal = stage === "locala";
  const olympiadYears = getOlympiadYearsForSubject("matematica");
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="border-b border-zinc-200 pb-5">
          <div>
            <Link
              href="/olimpiade"
              className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 hover:text-emerald-950"
            >
              Olimpiade
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Matematică · {stageName} · Clasa a {grade}-a
            </h1>
          </div>
        </header>

        <div className="flex flex-col gap-8">
          {olympiadYears.map((year) => {
            const yearDocuments = getOlympiadDocuments({ stage, year, grade });
            const availableCountyCount = olympiadCounties.filter((county) =>
              getOlympiadWorkspaces({ stage, grade, year, county }).length > 0,
            ).length;

            return (
            <section key={year} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <h2 className="text-2xl font-semibold">{year}</h2>
                <span className="text-sm text-zinc-600">
                  {isLocal
                    ? `${availableCountyCount}/${olympiadCounties.length} județe`
                    : `${yearDocuments.length} documente`}
                </span>
              </div>

              {isLocal ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {olympiadCounties.map((county) => (
                    (() => {
                      const documentCount = getOlympiadDocuments({
                        stage,
                        year,
                        county,
                        grade,
                      }).length;
                      const hasWorkspace =
                        getOlympiadWorkspaces({ stage, grade, year, county }).length > 0;
                      const label = documentCount > 0
                        ? `${documentCount} documente`
                        : hasWorkspace
                          ? "Material comun"
                          : "Indisponibil";
                      const content = (
                        <>
                          <span className="flex items-start justify-between gap-2">
                            <MapPin className="h-5 w-5 opacity-70" />
                            {hasWorkspace ? (
                              <ArrowRight className="h-4 w-4 opacity-60" />
                            ) : null}
                          </span>
                          <span className="mt-4">
                            <h3 className="font-semibold">{county}</h3>
                            <span className="mt-1 block text-xs opacity-70">
                              {label}
                            </span>
                          </span>
                        </>
                      );

                      return hasWorkspace ? (
                        <Link
                          key={county}
                          href={`/olimpiade/olimpiada-de-matematica/${stage}/${year}/${olympiadCountySlug(county)}?clasa=${grade}`}
                          className="group flex min-h-24 flex-col justify-between border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:min-h-28"
                        >
                          {content}
                        </Link>
                      ) : (
                        <article
                          key={county}
                          className="flex min-h-24 flex-col justify-between border border-zinc-200 bg-zinc-100 p-4 text-zinc-500 sm:min-h-28"
                        >
                          {content}
                        </article>
                      );
                    })()
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {(() => {
                    const documentCount = getOlympiadDocuments({ stage, year, grade }).length;
                    const content = <>
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-lg font-semibold">
                        Etapa {stageName.toLocaleLowerCase("ro")}
                      </span>
                      <Trophy className="h-5 w-5 opacity-70" />
                    </span>
                    <span>
                      <span className="mt-1 block text-xs opacity-70">
                        {documentCount > 0 ? `${documentCount} documente` : "Indisponibil"}
                      </span>
                    </span>
                    </>;

                    return documentCount > 0 ? (
                      <Link
                        href={`/olimpiade/olimpiada-de-matematica/${stage}/${year}?clasa=${grade}`}
                        className="group flex min-h-28 flex-col justify-between border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:min-h-36"
                      >{content}</Link>
                    ) : (
                      <article className="flex min-h-28 flex-col justify-between border border-zinc-200 bg-zinc-100 p-4 text-zinc-500 sm:min-h-36">{content}</article>
                    );
                  })()}
                </div>
              )}
            </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
