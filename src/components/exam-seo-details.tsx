import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import type { Exam } from "@/lib/schemas";

type ExamSeoDetailsProps = {
  exam: Exam;
  documentKind: "subject" | "barem";
  yearHubPath?: string;
};

export function ExamSeoDetails({
  exam,
  documentKind,
  yearHubPath,
}: ExamSeoDetailsProps) {
  const isSubject = documentKind === "subject";
  const pdfPath = isSubject ? exam.examPdfPath : exam.baremPdfPath;
  const sourceUrl = isSubject ? exam.sourceUrl : exam.baremSourceUrl;

  return (
    <section className="border-t border-zinc-200 bg-white text-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">
              {exam.platform ? "Platformă" : "Document"}
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              {!exam.platform ? (
                <a
                  href={pdfPath}
                  className="inline-flex min-h-11 items-center gap-2 bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Descarcă
                </a>
              ) : null}
              {exam.platform ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-zinc-300 bg-white px-4 text-sm font-semibold transition hover:border-zinc-950"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Deschide proba
                </a>
              ) : null}
            </div>
          </div>

          <aside className="border border-zinc-200 bg-[#f7f8f5] p-5 text-sm">
            <dl className="divide-y divide-zinc-200">
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-zinc-600">{exam.category === "evaluare-nationala" ? "Nivel" : "Profil"}</dt><dd className="text-right font-semibold">{exam.profile}</dd></div>
            </dl>
            <div className="mt-4 flex flex-col gap-2 font-semibold text-emerald-800">
              {yearHubPath ? <Link href={yearHubPath} className="hover:text-emerald-950">{exam.year}</Link> : null}
              <Link href="/metodologie" className="hover:text-emerald-950">Metodologie</Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
