import Link from "next/link";
import {
  ArrowRight,
  Atom,
  BookOpenText,
  BrainCircuit,
  Calculator,
  Code2,
  Dna,
  Earth,
  Flame,
  FlaskConical,
  Globe2,
  Landmark,
  Languages,
  MessagesSquare,
  Microscope,
  MonitorCog,
  Scale,
  ShieldCheck,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import {
  olympiadSubjects,
  type OlympiadSubjectId,
} from "@/lib/olympiad-subjects";

const subjectIcons: Record<OlympiadSubjectId, LucideIcon> = {
  romana: BookOpenText,
  matematica: Calculator,
  fizica: Atom,
  chimie: FlaskConical,
  biologie: Dna,
  "astronomie-si-astrofizica": Telescope,
  geografie: Globe2,
  istorie: Landmark,
  "memoria-holocaustului": Flame,
  "stiinte-socio-umane": Scale,
  "limba-engleza": Languages,
  "limba-franceza": Languages,
  "limba-germana-moderna": Languages,
  "limbi-romanice": Languages,
  lingvistica: MessagesSquare,
  "stiinte-pentru-juniori": Microscope,
  "stiintele-pamantului": Earth,
  "tehnologia-informatiei-si-comunicatiilor": MonitorCog,
  informatica: Code2,
  "inteligenta-artificiala": BrainCircuit,
  "securitate-cibernetica": ShieldCheck,
};

export function OlympiadSubjectPicker() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <header className="max-w-3xl border-b border-zinc-200/80 pb-7">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Olimpiade
          </h1>
        </header>

        <div className="pt-7">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {olympiadSubjects.map((subject) => {
              const Icon = subjectIcons[subject.id];

              return (
                <Link
                  key={subject.id}
                  href={subject.path}
                  className={`group flex min-h-24 flex-col justify-between border p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:min-h-28 sm:p-4 ${subject.accent}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <Icon
                      className="h-5 w-5 shrink-0 opacity-75 sm:h-6 sm:w-6"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <ArrowRight
                      className="h-4 w-4 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-70 group-focus:opacity-70"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-base font-semibold tracking-[-0.02em] sm:text-lg">
                    {subject.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
