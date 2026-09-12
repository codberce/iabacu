"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, FileText } from "lucide-react";
import {
  ArchiveFilters,
  type ArchiveFilterOption,
} from "@/components/archive-filters";
import { subjects } from "@/components/subject-picker";
import {
  ATTEMPTS_UPDATED_EVENT,
  bestScoreForExam,
  loadAttempts,
} from "@/lib/attempts";
import {
  archiveDefaultFilters,
  archiveFiltersFromRecord,
  archiveFiltersFromSearchParams,
  archiveSearchIncludes,
  archiveSearchParams,
  type ArchiveFilterValues,
} from "@/lib/archive-search";
import { groupExamsByYear } from "@/lib/exams";
import { getExamVariants, subjectVariants } from "@/lib/exam-variants";
import type { AttemptRecord, Exam } from "@/lib/schemas";
import { formatScore, scoreBand } from "@/lib/score";

export type ExamGridNavItem = {
  id: string;
  label: string;
  href: string;
  accent: string;
};

export type ExamGridSearchParams = Record<
  string,
  string | string[] | undefined
>;

type ExamGridProps = {
  exams: Exam[];
  subject: Exam["subject"];
  title?: string;
  homeHref?: string;
  homeLabel?: string;
  archiveHref?: string;
  navItems?: ExamGridNavItem[];
  currentNavId?: string;
  navigationLabel?: string;
  searchPlaceholder?: string;
  allSessionsLabel?: string;
  emptyMessage?: string;
  sessionLabels?: Partial<Record<Exam["sessionType"], string>>;
  initialSessionFilter?: Exam["sessionType"] | "all";
  defaultYearFilter?: number | "all";
  initialSearchParams?: ExamGridSearchParams;
  showProfilePicker?: boolean;
  footerContent?: ReactNode;
};

const defaultSessionLabels: Record<Exam["sessionType"], string> = {
  model: "Model",
  simulation: "Simulare",
  special: "Specială",
  final: "Sesiune finală",
  reserve: "Rezervă",
  autumn: "August",
};

function archivePathWithFilters(
  archiveHref: string,
  filters: ArchiveFilterValues,
  defaults: ArchiveFilterValues,
) {
  const url = new URL(archiveHref, "https://iabacu.local");
  const query = archiveSearchParams(url.searchParams, filters, defaults);
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export function ExamGrid({
  exams,
  subject,
  title,
  homeHref = "/bacalaureat",
  homeLabel = "Bacalaureat",
  archiveHref = `/${subject}`,
  navItems,
  currentNavId,
  navigationLabel = "Materii",
  searchPlaceholder = "Caută",
  allSessionsLabel = "Toate sesiunile",
  emptyMessage = "Nu există examene pentru filtrele alese.",
  sessionLabels,
  initialSessionFilter = "all",
  defaultYearFilter = "all",
  initialSearchParams = {},
  showProfilePicker = true,
  footerContent,
}: ExamGridProps) {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const profiles = useMemo(
    () => (showProfilePicker ? subjectVariants[subject] ?? [] : []),
    [showProfilePicker, subject],
  );
  const effectiveSessionLabels = useMemo(
    () => ({ ...defaultSessionLabels, ...sessionLabels }),
    [sessionLabels],
  );
  const navigationItems =
    navItems ??
    subjects.map((item) => ({
      id: item.id,
      label: item.name,
      href: item.href,
      accent: item.accent,
    }));
  const activeNavigationId = currentNavId ?? subject;
  const years = useMemo(
    () => Array.from(new Set(exams.map((exam) => exam.year))).sort((a, b) => b - a),
    [exams],
  );
  const sessionTypes = useMemo(
    () =>
      Array.from(new Set(exams.map((exam) => exam.sessionType))).sort((a, b) =>
        effectiveSessionLabels[a].localeCompare(effectiveSessionLabels[b], "ro"),
      ),
    [effectiveSessionLabels, exams],
  );
  const filterOptions = useMemo(
    () => ({
      years,
      sessions: sessionTypes,
      profiles,
      defaultYear: years.includes(defaultYearFilter as number)
        ? defaultYearFilter
        : "all" as const,
      defaultSession: sessionTypes.includes(initialSessionFilter as Exam["sessionType"])
        ? initialSessionFilter
        : "all",
    }),
    [defaultYearFilter, initialSessionFilter, profiles, sessionTypes, years],
  );
  const defaultFilters = useMemo<ArchiveFilterValues>(
    () => ({
      ...archiveDefaultFilters,
      year: filterOptions.defaultYear,
      session: filterOptions.defaultSession,
    }),
    [filterOptions.defaultSession, filterOptions.defaultYear],
  );
  const [filters, setFilters] = useState<ArchiveFilterValues>(() =>
    archiveFiltersFromRecord(initialSearchParams, filterOptions),
  );
  const addressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const bestScore = bestScoreForExam(exam.id, attempts);
      const textMatch = archiveSearchIncludes(
        [
          exam.title,
          exam.sessionLabel,
          exam.dateLabel,
          String(exam.year),
          effectiveSessionLabels[exam.sessionType],
          ...getExamVariants(exam),
        ].join(" "),
        filters.q,
      );
      const yearMatch = filters.year === "all" || exam.year === filters.year;
      const profileMatch =
        filters.profile === "all" ||
        getExamVariants(exam).includes(filters.profile);
      const sessionMatch =
        filters.session === "all" || exam.sessionType === filters.session;
      const statusMatch =
        filters.progress === "all" ||
        (filters.progress === "not-started" && bestScore == null) ||
        (filters.progress === "started" && bestScore != null) ||
        (filters.progress === "high" && bestScore != null && bestScore >= 9) ||
        (filters.progress === "needs-work" && bestScore != null && bestScore < 7);
      return textMatch && yearMatch && profileMatch && sessionMatch && statusMatch;
    });
  }, [attempts, effectiveSessionLabels, exams, filters]);
  const grouped = useMemo(() => {
    let groups = groupExamsByYear(filteredExams);
    if (filters.sort === "oldest") groups = groups.toReversed();
    if (filters.sort === "unstarted") {
      groups = groups.map((group) => ({
        ...group,
        exams: group.exams.toSorted((a, b) => {
          const aStarted = bestScoreForExam(a.id, attempts) == null ? 0 : 1;
          const bStarted = bestScoreForExam(b.id, attempts) == null ? 0 : 1;
          return aStarted - bStarted || a.order - b.order;
        }),
      }));
    }
    return groups;
  }, [attempts, filteredExams, filters.sort]);
  const returnHref = archivePathWithFilters(archiveHref, filters, defaultFilters);
  const sessionOptions: ArchiveFilterOption[] = sessionTypes.map((value) => ({
    value,
    label: effectiveSessionLabels[value],
  }));
  const profileOptions: ArchiveFilterOption[] = profiles.map((value) => ({
    value,
    label: value,
  }));

  useEffect(() => {
    const refresh = () => setAttempts(loadAttempts());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(ATTEMPTS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ATTEMPTS_UPDATED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    const restoreFilters = () => {
      setFilters(archiveFiltersFromSearchParams(
        new URLSearchParams(window.location.search),
        filterOptions,
      ));
    };
    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, [defaultFilters.session, filterOptions]);

  useEffect(() => {
    return () => {
      if (addressTimerRef.current) clearTimeout(addressTimerRef.current);
    };
  }, []);

  function updateFilters(
    next: ArchiveFilterValues,
    options?: { debounce?: boolean },
  ) {
    setFilters(next);
    if (addressTimerRef.current) clearTimeout(addressTimerRef.current);
    const updateAddress = () => {
      const nextPath = archivePathWithFilters(archiveHref, next, defaultFilters);
      window.history.replaceState(window.history.state, "", nextPath);
    };
    if (options?.debounce) {
      addressTimerRef.current = setTimeout(updateAddress, 180);
    } else {
      updateAddress();
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f7f8f5] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="border-b border-zinc-200/80 pb-5">
          <div className="min-w-0">
              <Link
                href={homeHref}
                className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 hover:text-emerald-950"
              >
                {homeLabel}
              </Link>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-4xl">
                {title ?? subjects.find((item) => item.id === subject)?.name}
              </h1>
          </div>
          <div className={`mt-5 flex items-center gap-2 pb-1 text-sm ${navItems ? "" : "overflow-x-auto"}`}>
            <nav
              aria-label={navigationLabel}
              className={`flex gap-2 ${navItems ? "flex-wrap" : "min-w-max"}`}
            >
              {navigationItems.filter((item) => item.id !== activeNavigationId).map((item) => {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`inline-flex min-h-9 items-center justify-center border px-3 text-xs font-semibold opacity-55 transition hover:opacity-90 ${item.accent}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <ArchiveFilters
          filters={filters}
          years={years}
          sessions={sessionOptions}
          profiles={profileOptions}
          searchPlaceholder={searchPlaceholder}
          allSessionsLabel={allSessionsLabel}
          defaultFilters={defaultFilters}
          resultCount={filteredExams.length}
          onChange={updateFilters}
        />

        <div className="flex flex-col gap-8">
          {grouped.length === 0 ? (
            <section className="border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-700">
              {emptyMessage}
            </section>
          ) : null}
          {grouped.map(({ year, exams: yearExams }) => (
            <section key={year} className="flex flex-col gap-3">
              {grouped.length > 1 || filters.year === "all" ? (
                <h2 className="border-b border-zinc-200 pb-2 text-2xl font-semibold">{year}</h2>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {yearExams.map((exam) => {
                  const bestScore = bestScoreForExam(exam.id, attempts);
                  const band = scoreBand(bestScore);
                  const profileLabels = getExamVariants(exam);
                  const cardTitle = homeHref.startsWith("/olimpiade/")
                    ? exam.sessionLabel.replace(/^Etapa locală ·\s*/, "")
                    : exam.sessionLabel;
                  const examHref = `/exam/${exam.id}?from=${encodeURIComponent(returnHref)}`;
                  return (
                    <Link
                      key={exam.id}
                      href={examHref}
                      className={`group flex min-h-28 flex-col justify-between border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:min-h-36 ${band.tileClass}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-base font-semibold leading-6 sm:text-lg">
                            {cardTitle}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-sm opacity-80">
                            <CalendarDays className="h-4 w-4 shrink-0" />
                            <span className="truncate">{exam.dateLabel}</span>
                          </span>
                        </span>
                        <FileText className="h-5 w-5 shrink-0 opacity-70 transition group-hover:opacity-100" />
                      </span>

                      {showProfilePicker || bestScore != null ? (
                        <span className="mt-4 flex flex-wrap items-end gap-2 sm:mt-6">
                          {showProfilePicker
                            ? (profileLabels.length > 0
                                ? profileLabels
                                : [exam.profile]
                              ).map((variant) => (
                                <span
                                  key={variant}
                                  className="border border-current/20 bg-white/55 px-2.5 py-1 text-xs font-semibold"
                                >
                                  {variant}
                                </span>
                              ))
                            : null}
                          {bestScore != null ? (
                            <span className={`px-2.5 py-1 text-xs ${band.badgeClass}`}>
                              Max {formatScore(bestScore)}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {footerContent}
      </div>
    </main>
  );
}
