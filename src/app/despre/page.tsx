import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Despre iabacu",
  description: "O arhivă simplă și deschisă de subiecte și bareme pentru bacalaureat și olimpiade.",
  path: "/despre",
  keywords: ["iabacu", "despre iabacu", "pregatire bac online"],
});

const principles = [
  {
    title: "Fără cont",
    description: "Progresul și conversațiile se păstrează numai în browser.",
  },
  {
    title: "Subiect–barem",
    description: "Fiecare variantă vine în pereche cu baremul corespunzător.",
  },
  {
    title: "Open source",
    description: "Codul și validările sunt publice.",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <article className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
          iabacu
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-zinc-700">
          Arhivă open-source pentru Bac și olimpiade.
        </p>

        <section className="mt-10 grid gap-3 border-t border-zinc-200 pt-8 sm:grid-cols-3" aria-label="Principiile proiectului">
          {principles.map((principle) => (
            <div key={principle.title} className="border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">{principle.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {principle.description}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-10 border-t border-zinc-200 pt-8">
          <p className="max-w-3xl leading-7 text-zinc-700">
            Proiect independent. AI-ul este orientativ; baremul rămâne referința.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-emerald-800">
            <Link href="/metodologie" className="hover:text-emerald-950">
              Surse și metodologie
            </Link>
            <a
              href="https://github.com/codberce/iabacu"
              rel="noreferrer"
              className="hover:text-emerald-950"
            >
              Codul sursă pe GitHub
            </a>
          </div>
        </section>
      </article>
    </main>
  );
}
