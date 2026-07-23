import Link from "next/link";
import {
  ArrowRight,
  Atom,
  BookMarked,
  BookOpenText,
  Brain,
  Calculator,
  Code2,
  Dna,
  FlaskConical,
  Globe2,
  Landmark,
  MessageCircleQuestion,
  Scale,
  Trophy,
  Users,
} from "lucide-react";
import { currentBacYear } from "@/lib/seo";

export const subjects = [
  {
    id: "romana",
    name: "Română",
    href: "/romana",
    icon: BookOpenText,
    accent: "border-rose-300 bg-rose-50 text-rose-950",
  },
  {
    id: "matematica",
    name: "Matematică",
    href: "/matematica",
    icon: Calculator,
    accent: "border-emerald-300 bg-emerald-50 text-emerald-950",
  },
  {
    id: "fizica",
    name: "Fizică",
    href: "/fizica",
    icon: Atom,
    accent: "border-amber-300 bg-amber-50 text-amber-950",
  },
  {
    id: "informatica",
    name: "Informatică",
    href: "/informatica",
    icon: Code2,
    accent: "border-sky-300 bg-sky-50 text-sky-950",
  },
  {
    id: "istorie",
    name: "Istorie",
    href: "/istorie",
    icon: BookMarked,
    accent: "border-orange-300 bg-orange-50 text-orange-950",
  },
  { id: "biologie", name: "Biologie", href: "/biologie", icon: Dna, accent: "border-lime-300 bg-lime-50 text-lime-950" },
  { id: "chimie", name: "Chimie", href: "/chimie", icon: FlaskConical, accent: "border-cyan-300 bg-cyan-50 text-cyan-950" },
  { id: "geografie", name: "Geografie", href: "/geografie", icon: Globe2, accent: "border-teal-300 bg-teal-50 text-teal-950" },
  { id: "logica", name: "Logică", href: "/logica", icon: Scale, accent: "border-indigo-300 bg-indigo-50 text-indigo-950" },
  { id: "psihologie", name: "Psihologie", href: "/psihologie", icon: Brain, accent: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950" },
  { id: "sociologie", name: "Sociologie", href: "/sociologie", icon: Users, accent: "border-purple-300 bg-purple-50 text-purple-950" },
  { id: "economie", name: "Economie", href: "/economie", icon: Landmark, accent: "border-yellow-300 bg-yellow-50 text-yellow-950" },
  { id: "filosofie", name: "Filosofie", href: "/filosofie", icon: MessageCircleQuestion, accent: "border-pink-300 bg-pink-50 text-pink-950" },
];

const subjectGroups = [
  {
    id: "common",
    label: "Materii comune",
    subjectIds: ["romana", "matematica"],
  },
  {
    id: "real",
    label: "Profil real",
    subjectIds: ["fizica", "informatica", "chimie", "biologie"],
  },
  {
    id: "uman",
    label: "Profil uman",
    subjectIds: [
      "istorie",
      "geografie",
      "logica",
      "psihologie",
      "sociologie",
      "economie",
      "filosofie",
    ],
  },
].map((group) => ({
  ...group,
  subjects: group.subjectIds.map((id) => subjects.find((subject) => subject.id === id)!),
}));

export function SubjectPicker() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <header className="grid gap-6 border-b border-zinc-200/80 pb-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
              iabacu · Bacalaureat
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Subiecte și bareme.
            </h1>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/bacalaureat/${currentBacYear}`}
                className="inline-flex min-h-11 items-center gap-2 bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                {currentBacYear}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/bacalaureat"
                className="inline-flex min-h-11 items-center border border-zinc-300 bg-white px-4 text-sm font-semibold transition hover:border-zinc-950"
              >
                Toți anii
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              href="/evaluare-nationala"
              className="group flex items-center justify-between gap-4 border border-sky-200 bg-sky-50 p-4 text-sky-950 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md sm:p-5"
            >
              <span><span className="block font-semibold">Evaluarea Națională</span><span className="mt-1 block text-xs text-sky-700">Clasa a VIII-a · Română și Matematică</span></span>
              <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href="/olimpiade"
            className="group flex items-center justify-between gap-4 border border-violet-200 bg-violet-50 p-4 text-violet-950 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md sm:p-5"
          >
            <span className="flex min-w-0 items-center gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-100">
                <Trophy className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span>
                <span className="block font-semibold">
                  Olimpiade
                </span>
                <span className="mt-1 block text-xs text-violet-700">Alege disciplina</span>
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </header>

        <section className="pt-7" aria-labelledby="subjects-heading">
          <h2
            id="subjects-heading"
            className="mb-4 text-2xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-3xl"
          >
            Materii
          </h2>
          <div className="space-y-5">
            {subjectGroups.map((group) => (
              <div key={group.id}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                  {group.label}
                </h3>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  {group.subjects.map((subject) => {
                    const Icon = subject.icon;

                    return (
                      <Link
                        key={subject.name}
                        href={subject.href}
                        className={`group flex min-h-24 flex-col justify-between border p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:min-h-28 sm:p-4 ${subject.accent}`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <Icon
                            className="h-5 w-5 shrink-0 opacity-75 sm:h-6 sm:w-6"
                            strokeWidth={1.8}
                          />
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-70 group-focus:opacity-70" />
                        </span>
                        <span className="text-base font-semibold tracking-[-0.02em] sm:text-lg">
                          {subject.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
