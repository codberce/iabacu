import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata, siteContentUpdatedAt } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Metodologie",
  description: "Cum selectăm, verificăm și publicăm subiectele și baremele de bacalaureat și olimpiadă.",
  path: "/metodologie",
  keywords: ["metodologie iabacu", "verificare subiecte bac", "selectare documente"],
});

export default function MethodologyPage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <article className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Ultima actualizare: {siteContentUpdatedAt}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Metodologie</h1>

        <div className="mt-10 space-y-10">
          <section>
            <h2 className="text-2xl font-semibold">1. Selectarea documentelor</h2>
            <p className="mt-3 leading-7 text-zinc-700">Lucrăm cu subiecte și bareme din sesiunile publicate oficial. Validăm fiecare PDF prin amprenta SHA-256 și prin potrivirea perechii subiect–barem.</p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold">2. Asocierea subiect–barem</h2>
            <p className="mt-3 leading-7 text-zinc-700">Legăm subiectul și baremul numai când identificatorii și contextul coincid. Amprentele SHA-256 detectează PDF-urile duplicate.</p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold">3. Ce înseamnă „oficial”</h2>
            <p className="mt-3 leading-7 text-zinc-700">Eticheta descrie documentul, nu platforma. iabacu este independent de instituțiile organizatoare.</p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold">4. Instrumentele AI</h2>
            <p className="mt-3 leading-7 text-zinc-700">Rezultatele AI sunt orientative. Baremul PDF sau punctajul platformei rămâne referința.</p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold">5. Erori și actualizări</h2>
            <p className="mt-3 leading-7 text-zinc-700">Raportează asocierile sau PDF-urile greșite pe <a href="https://github.com/codberce/iabacu/issues" rel="noreferrer" className="font-semibold text-emerald-800 hover:text-emerald-950">GitHub</a>, cu URL-ul paginii.</p>
          </section>
        </div>

        <p className="mt-10 border-t border-zinc-200 pt-8 leading-7 text-zinc-700"><Link href="/despre" className="font-semibold text-emerald-800 hover:text-emerald-950">Despre proiect</Link></p>
      </article>
    </main>
  );
}
