export function RouteLoading({ label = "Se încarcă pagina" }: { label?: string }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 text-sm font-semibold text-zinc-700">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-700" aria-hidden="true" />
        {label}
      </div>
    </main>
  );
}
