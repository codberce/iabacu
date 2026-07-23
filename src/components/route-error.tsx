"use client";

import { useEffect } from "react";

export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("route_error", { name: error.name, digest: error.digest });
  }, [error.digest, error.name]);

  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="max-w-xl border border-amber-300 bg-amber-50 p-6 text-zinc-900" aria-labelledby="route-error-title">
        <h1 id="route-error-title" className="text-xl font-semibold">Pagina nu a putut fi încărcată</h1>
        <p className="mt-2 leading-6 text-zinc-700">Verifică conexiunea și încearcă din nou. Documentele și progresul tău local nu au fost șterse.</p>
        <button type="button" onClick={reset} className="mt-5 min-h-11 border border-zinc-950 bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
          Încearcă din nou
        </button>
      </section>
    </main>
  );
}
