export type ArchiveSort = "newest" | "oldest" | "unstarted";

export type ArchiveFilterValues = {
  q: string;
  year: number | "all";
  session: string;
  profile: string;
  progress: string;
  sort: ArchiveSort;
};

export const archiveDefaultFilters: ArchiveFilterValues = {
  q: "",
  year: "all",
  session: "all",
  profile: "all",
  progress: "all",
  sort: "newest",
};

/** Makes Romanian archive matching independent of accents and casing. */
export function normalizeArchiveSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("ro")
    .trim();
}

export function archiveSearchIncludes(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeArchiveSearch(query);
  if (!normalizedQuery) return true;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const normalizedHaystack = normalizeArchiveSearch(haystack);
  return terms.every((term) => normalizedHaystack.includes(term));
}

export function archiveFiltersFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
  options: {
    years: readonly number[];
    sessions: readonly string[];
    profiles: readonly string[];
    defaultYear?: number | "all";
    defaultSession?: string;
  },
): ArchiveFilterValues {
  const rawYear = searchParams.get("year");
  const yearValue = Number(rawYear);
  const rawSession = searchParams.get("session");
  const sort = searchParams.get("sort");
  return {
    q: searchParams.get("q")?.trim() ?? "",
    year:
      rawYear === "all"
        ? "all"
        : options.years.includes(yearValue)
          ? yearValue
          : options.defaultYear ?? "all",
    session:
      rawSession === "all"
        ? "all"
        : options.sessions.includes(rawSession ?? "")
          ? rawSession!
          : options.defaultSession ?? "all",
    profile: options.profiles.includes(searchParams.get("profile") ?? "")
      ? searchParams.get("profile")!
      : "all",
    progress: ["not-started", "started", "high", "needs-work"].includes(
      searchParams.get("progress") ?? "",
    )
      ? searchParams.get("progress")!
      : "all",
    sort: sort === "oldest" || sort === "unstarted" ? sort : "newest",
  };
}

export function archiveFiltersFromRecord(
  values: Record<string, string | string[] | undefined>,
  options: Parameters<typeof archiveFiltersFromSearchParams>[1],
): ArchiveFilterValues {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(values)) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value != null) params.set(key, value);
  }
  return archiveFiltersFromSearchParams(params, options);
}

/** Updates only archive-owned params and omits default values for one canonical URL. */
export function archiveSearchParams(
  current: Pick<URLSearchParams, "toString" | "delete" | "set">,
  filters: ArchiveFilterValues,
  defaults: ArchiveFilterValues = archiveDefaultFilters,
): string {
  const params = new URLSearchParams(current.toString());
  const values: Record<keyof ArchiveFilterValues, string | undefined> = {
    q: filters.q.trim() === defaults.q ? undefined : filters.q.trim() || undefined,
    year: filters.year === defaults.year ? undefined : String(filters.year),
    session: filters.session === defaults.session ? undefined : filters.session,
    profile: filters.profile === defaults.profile ? undefined : filters.profile,
    progress: filters.progress === defaults.progress ? undefined : filters.progress,
    sort: filters.sort === defaults.sort ? undefined : filters.sort,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}
