import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import {
  olympiadArchivePathForSubject,
  getOlympiadGradesForSubject,
  olympiadGrades,
  type OlympiadGrade,
  type OlympiadStageSlug,
} from "@/lib/competitions";
import { getOlympiadSubject, type OlympiadSubjectId } from "@/lib/olympiad-subjects";

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

const gradeGroups: Array<{
  id: string;
  label: string;
  grades: readonly OlympiadGrade[];
}> = [
  { id: "gimnaziu", label: "Gimnaziu", grades: olympiadGrades.slice(0, 4) },
  { id: "liceu", label: "Liceu", grades: olympiadGrades.slice(4) },
];

export function OlympiadGradePicker({
  olympiadSubject = "matematica",
  stage,
}: {
  olympiadSubject?: OlympiadSubjectId;
  stage?: OlympiadStageSlug;
}) {
  const subject = getOlympiadSubject(olympiadSubject);
  if (!subject) return null;
  const availableGrades = new Set(getOlympiadGradesForSubject(olympiadSubject));
  const groups = gradeGroups
    .map((group) => ({
      ...group,
      grades: group.grades.filter((grade) => availableGrades.has(grade)),
    }))
    .filter((group) => group.grades.length > 0);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <header className="max-w-3xl border-b border-zinc-200/80 pb-6">
          <Link
            href="/olimpiade"
            className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 hover:text-emerald-950"
          >
            Olimpiade
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {subject.olympiadName}
          </h1>
        </header>

        <div className="mt-7 space-y-8">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`grades-${group.id}`}>
              <h2
                id={`grades-${group.id}`}
                className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500"
              >
                {group.label}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {group.grades.map((grade) => {
                  const accent = gradeAccents[olympiadGrades.indexOf(grade)];
                  return (
                    <Link
                      key={grade}
                      href={olympiadArchivePathForSubject(olympiadSubject, grade, stage)}
                      className={`group flex min-h-32 flex-col justify-between border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:min-h-40 sm:p-5 ${accent}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-lg font-semibold tracking-[-0.02em] sm:text-xl">
                          Clasa a {grade}-a
                        </span>
                        <Trophy
                          className="h-5 w-5 shrink-0 opacity-65"
                          strokeWidth={1.8}
                        />
                      </span>
                      <span className="flex items-center justify-end opacity-70">
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
