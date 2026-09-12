"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, Search, SlidersHorizontal, Trophy, X } from "lucide-react";
import {
  archiveDefaultFilters,
  type ArchiveFilterValues,
} from "@/lib/archive-search";

export type ArchiveFilterOption = { value: string; label: string };

type ArchiveFiltersProps = {
  filters: ArchiveFilterValues;
  years: readonly number[];
  sessions: readonly ArchiveFilterOption[];
  profiles?: readonly ArchiveFilterOption[];
  searchPlaceholder?: string;
  allSessionsLabel?: string;
  defaultFilters?: ArchiveFilterValues;
  resultCount?: number;
  onChange: (next: ArchiveFilterValues, options?: { debounce?: boolean }) => void;
};

export function ArchiveFilters({
  filters,
  years,
  sessions,
  profiles = [],
  searchPlaceholder = "Caută",
  allSessionsLabel = "Toate sesiunile",
  defaultFilters = archiveDefaultFilters,
  resultCount,
  onChange,
}: ArchiveFiltersProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  function update(patch: Partial<ArchiveFilterValues>, debounce = false) {
    onChange({ ...filters, ...patch }, { debounce });
  }

  const hasFilters = Object.keys(defaultFilters).some(
    (key) =>
      filters[key as keyof ArchiveFilterValues] !==
      defaultFilters[key as keyof ArchiveFilterValues],
  );

  return (
    <section
      aria-label="Filtrează arhiva"
      className="sticky top-[var(--header-height)] z-10 -mx-4 border-y border-zinc-200/80 bg-[#f7f8f5]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <label className="flex min-h-11 items-center gap-2 border border-zinc-300 bg-white px-3 focus-within:ring-2 focus-within:ring-zinc-900">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <span className="sr-only">Caută examen</span>
          <input
            value={filters.q}
            onChange={(event) => {
              const value = event.target.value;
              update({ q: value }, true);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder={searchPlaceholder}
            type="search"
          />
        </label>

        <label className="flex min-h-11 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm">
          <CalendarDays className="h-4 w-4 shrink-0 text-zinc-500" />
          <span className="sr-only">Sari la anul</span>
          <select
            value={filters.year}
            onChange={(event) => update({ year: event.target.value === "all" ? "all" : Number(event.target.value) })}
            className="w-full bg-transparent outline-none sm:w-28"
          >
            <option value="all">Toți anii</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>

        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="archive-more-filters"
          onClick={() => setMoreOpen((open) => !open)}
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-semibold hover:border-zinc-950"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtre
        </button>
      </div>

      <div id="archive-more-filters" hidden={!moreOpen} className="mt-3 grid gap-3 border-t border-zinc-200 pt-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label="Sesiune" icon={<SlidersHorizontal className="h-4 w-4 shrink-0 text-zinc-500" />} value={filters.session} options={[{ value: "all", label: allSessionsLabel }, ...sessions]} onChange={(session) => update({ session })} />
        <FilterSelect label="Progres" icon={<Trophy className="h-4 w-4 shrink-0 text-zinc-500" />} value={filters.progress} options={[
          { value: "all", label: "Tot progresul" },
          { value: "not-started", label: "Neîncepute" },
          { value: "started", label: "Rezolvate" },
          { value: "high", label: "9.00+" },
          { value: "needs-work", label: "Sub 7.00" },
        ]} onChange={(progress) => update({ progress })} />
        {profiles.length > 1 ? <FilterSelect label="Variantă" value={filters.profile} options={[{ value: "all", label: "Toate variantele" }, ...profiles]} onChange={(profile) => update({ profile })} /> : null}
        <FilterSelect label="Sortează" value={filters.sort} options={[
          { value: "newest", label: "Cele mai noi" },
          { value: "oldest", label: "Cele mai vechi" },
          { value: "unstarted", label: "Neîncepute întâi" },
        ]} onChange={(sort) => update({ sort: sort as ArchiveFilterValues["sort"] })} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="text-zinc-500">
          {resultCount == null
            ? "Filtrele sunt păstrate în adresă."
            : `${resultCount} ${resultCount === 1 ? "rezultat" : "rezultate"}`}
        </span>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => onChange(defaultFilters)}
            className="inline-flex min-h-8 items-center gap-1.5 text-zinc-700 hover:text-zinc-950"
          >
            <X className="h-3.5 w-3.5" /> Reset
          </button>
        ) : null}
      </div>
    </section>
  );
}

function FilterSelect({ label, icon, value, options, onChange }: {
  label: string;
  icon?: ReactNode;
  value: string;
  options: readonly ArchiveFilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm">
      {icon}
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent outline-none">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
