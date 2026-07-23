import type { Metadata } from "next";
import { CompetitionArchive } from "@/components/competition-archive";
import {
  ExamGrid,
  type ExamGridNavItem,
  type ExamGridSearchParams,
} from "@/components/exam-grid";
import { JsonLd } from "@/components/json-ld";
import { OlympiadGradePicker } from "@/components/olympiad-grade-picker";
import {
  getOlympiadStage,
  olympiadArchivePath,
  olympiadExams,
  olympiadGrades,
  olympiadSessionLabels,
  olympiadSessionTypeForStage,
  type OlympiadStageSlug,
  parseOlympiadGrade,
} from "@/lib/competitions";
import {
  absoluteUrl,
  createPageMetadata,
  siteName,
  siteUrl,
} from "@/lib/seo";

const title = "Olimpiada de Matematică: subiecte și bareme";
const description =
  "Subiecte și bareme de la Olimpiada de Matematică, organizate pe ani, clase și etape.";
const path = "/olimpiade/olimpiada-de-matematica";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  keywords: [
    "olimpiada de matematica",
    "subiecte olimpiada matematica",
    "bareme olimpiada matematica",
  ],
});

const gradeAccents = [
  "border-rose-200 bg-rose-50 text-rose-950",
  "border-orange-200 bg-orange-50 text-orange-950",
  "border-amber-200 bg-amber-50 text-amber-950",
  "border-lime-200 bg-lime-50 text-lime-950",
  "border-emerald-200 bg-emerald-50 text-emerald-950",
  "border-cyan-200 bg-cyan-50 text-cyan-950",
  "border-sky-200 bg-sky-50 text-sky-950",
  "border-violet-200 bg-violet-50 text-violet-950",
] as const;

function gradeNavigation(stage?: OlympiadStageSlug): ExamGridNavItem[] {
  return olympiadGrades.map((grade, index) => ({
    id: String(grade),
    label: String(grade),
    href: olympiadArchivePath(grade, stage),
    accent: gradeAccents[index],
  }));
}

export default async function MathematicsOlympiadPage({
  searchParams,
}: {
  searchParams: Promise<ExamGridSearchParams>;
}) {
  const filters = await searchParams;
  const clasa = Array.isArray(filters.clasa) ? filters.clasa[0] : filters.clasa;
  const etapa = Array.isArray(filters.etapa) ? filters.etapa[0] : filters.etapa;
  const grade = parseOlympiadGrade(clasa);
  const stage = etapa ? getOlympiadStage(etapa) : undefined;
  if (!grade) {
    return <OlympiadGradePicker stage={stage?.slug} />;
  }

  if (stage?.slug === "locala") {
    return <CompetitionArchive stage="locala" stageName="Locală" grade={grade} />;
  }

  const initialSessionFilter = stage
    ? olympiadSessionTypeForStage(stage.slug)
    : "all";
  const exams = olympiadExams
    .filter(
      (exam) =>
        exam.olympiadSubject === "matematica" &&
        exam.profile.endsWith(`clasa a ${grade}-a`),
    )
    .map((exam) => ({
      ...exam,
      sessionLabel: exam.sessionLabel,
    }));
  const pageTitle = `Matematică · Clasa a ${grade}-a`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: pageTitle,
          description,
          url: absoluteUrl(olympiadArchivePath(grade)),
          isPartOf: {
            "@type": "WebSite",
            name: siteName,
            url: siteUrl,
          },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: exams.length,
            itemListElement: exams.map((exam, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: exam.title,
              url: absoluteUrl(`/exam/${exam.id}`),
            })),
          },
        }}
      />
      <ExamGrid
        key={`${grade ?? "all"}-${initialSessionFilter}`}
        exams={exams}
        subject="matematica"
        title={pageTitle}
        homeHref="/olimpiade"
        homeLabel="Olimpiade"
        archiveHref={olympiadArchivePath(grade, stage?.slug)}
        navItems={gradeNavigation(stage?.slug)}
        currentNavId={String(grade)}
        navigationLabel="Clase"
        searchPlaceholder="Etapă, județ sau an"
        allSessionsLabel="Toate etapele"
        emptyMessage="Nu există variante de olimpiadă pentru filtrele alese."
        sessionLabels={olympiadSessionLabels}
        initialSessionFilter={initialSessionFilter}
        initialSearchParams={filters}
        showProfilePicker={false}
      />
    </>
  );
}
