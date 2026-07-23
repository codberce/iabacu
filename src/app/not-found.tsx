import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 text-center">
      <span
        className="mb-4 select-none text-[8rem] font-bold leading-none tracking-tight text-zinc-200"
        aria-hidden="true"
      >
        404
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
        Pagina nu există
      </h1>
      <p className="mt-2 max-w-sm text-balance text-sm leading-relaxed text-zinc-600">
        Nu am găsit nimic la această adresă. Verifică linkul sau începe de pe
        pagina principală.
      </p>
      <nav className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        >
          Pagina principală
        </Link>
        <Link
          href="/bacalaureat"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        >
          Bacalaureat
        </Link>
        <Link
          href="/olimpiade"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        >
          Olimpiade
        </Link>
        <Link
          href="/despre"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        >
          Despre
        </Link>
      </nav>
    </main>
  );
}
