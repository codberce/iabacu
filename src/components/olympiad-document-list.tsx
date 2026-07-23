import Link from "next/link";
import { BookOpenText, FileText } from "lucide-react";
import type {
  OlympiadDocument,
  OlympiadGrade,
  OlympiadStageSlug,
} from "@/lib/competitions";

const kindLabels = {
  subject: "Subiect",
  solution: "Soluții și barem",
  combined: "Subiecte și soluții",
};

export function OlympiadDocumentList({
  documents,
  stage,
  year,
  county,
  grade,
}: {
  documents: OlympiadDocument[];
  stage: OlympiadStageSlug;
  year: number;
  county?: string;
  grade: OlympiadGrade;
}) {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5">
          <div>
            <Link
              href={`/olimpiade/olimpiada-de-matematica/${stage}`}
              className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 hover:text-emerald-950"
            >
              Olimpiadă · Clasa a {grade}-a
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {county ? `${county} · ` : ""}{year}
            </h1>
            <p className="mt-2 text-sm text-zinc-600 sm:text-base">
              {documents.length} documente descărcate și verificate
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((document) => (
            <Link
              key={document.id}
              href={`/olimpiade/olimpiada-de-matematica/document/${document.id}?clasa=${grade}`}
              className="group flex min-h-28 flex-col justify-between border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:min-h-36"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-base font-semibold leading-6 sm:text-lg">
                    {kindLabels[document.kind]}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm opacity-80">
                    <BookOpenText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{document.title}</span>
                  </span>
                </span>
                <FileText className="h-5 w-5 shrink-0 opacity-70 transition group-hover:opacity-100" />
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
