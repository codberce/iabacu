import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ExamGrid,
  type ExamGridNavItem,
  type ExamGridSearchParams,
} from "@/components/exam-grid";
import { JsonLd } from "@/components/json-ld";
import { OlympiadGradePicker } from "@/components/olympiad-grade-picker";
import { PlatformArchive } from "@/components/platform-archive";
import {
  getOlympiadGradesForSubject,
  getOlympiadStage,
  olympiadArchivePathForSubject,
  olympiadExams,
  olympiadSessionLabels,
  olympiadSessionTypeForStage,
  parseOlympiadGrade,
  type OlympiadStageSlug,
} from "@/lib/competitions";
import {
  getOlympiadSubjectByPathSegment,
  type OlympiadSubjectId,
} from "@/lib/olympiad-subjects";
import { absoluteUrl, createPageMetadata, siteName, siteUrl } from "@/lib/seo";

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

function navigation(subjectId: OlympiadSubjectId, stage?: OlympiadStageSlug): ExamGridNavItem[] {
  return getOlympiadGradesForSubject(subjectId).map((grade, index) => ({
    id: String(grade),
    label: String(grade),
    href: olympiadArchivePathForSubject(subjectId, grade, stage),
    accent: gradeAccents[index % gradeAccents.length],
  }));
}

type PageProps = {
  params: Promise<{ olympiada: string }>;
  searchParams: Promise<ExamGridSearchParams>;
};

function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const subject = getOlympiadSubjectByPathSegment((await params).olympiada);
  if (!subject || subject.id === "matematica") return {};
  if (subject.mode === "platform") {
    return createPageMetadata({
      title: `${subject.olympiadName}: probe`,
      description: `Probele ${subject.olympiadName}, organizate pe ani, clase și etape.`,
      path: subject.path,
      keywords: [
        subject.olympiadName.toLocaleLowerCase("ro"),
        `probe ${subject.name.toLocaleLowerCase("ro")}`,
      ],
    });
  }
  return createPageMetadata({
    title: `${subject.olympiadName}: subiecte și bareme`,
    description: `Arhiva ${subject.olympiadName}, organizată pe ani, clase și etape.`,
    path: subject.path,
    keywords: [subject.olympiadName.toLocaleLowerCase("ro"), `subiecte ${subject.name.toLocaleLowerCase("ro")}`],
  });
}

export default async function OlympiadSubjectPage({ params, searchParams }: PageProps) {
  const subject = getOlympiadSubjectByPathSegment((await params).olympiada);
  if (!subject || subject.id === "matematica") notFound();

  const filters = await searchParams;
  const rawGrade = readSearchParam(filters.clasa);
  const rawStage = readSearchParam(filters.etapa);
  const grade = parseOlympiadGrade(rawGrade);
  const stage = rawStage ? getOlympiadStage(rawStage) : undefined;

  if (subject.mode === "platform") {
    if (!grade) {
      return <OlympiadGradePicker olympiadSubject={subject.id} stage={stage?.slug} />;
    }
    return (
      <PlatformArchive
        olympiadSubject={subject.id}
        grade={grade}
        stage={readSearchParam(filters.etapa)}
        year={readSearchParam(filters.an)}
        q={readSearchParam(filters.q)}
        page={readSearchParam(filters.pagina)}
      />
    );
  }

  if (!grade) {
    return <OlympiadGradePicker olympiadSubject={subject.id} stage={stage?.slug} />;
  }

  const exams = olympiadExams.filter(
    (exam) =>
      exam.olympiadSubject === subject.id &&
      exam.profile.endsWith(`clasa a ${grade}-a`),
  );
  const initialSessionFilter = stage ? olympiadSessionTypeForStage(stage.slug) : "all";
  const title = `${subject.name} · Clasa a ${grade}-a`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          url: absoluteUrl(olympiadArchivePathForSubject(subject.id, grade)),
          isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
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
        key={`${subject.id}-${grade}-${initialSessionFilter}`}
        exams={exams}
        subject={subject.examSubject}
        title={title}
        homeHref="/olimpiade"
        homeLabel="Olimpiade"
        archiveHref={olympiadArchivePathForSubject(subject.id, grade, stage?.slug)}
        navItems={navigation(subject.id, stage?.slug)}
        currentNavId={String(grade)}
        navigationLabel="Clase"
        searchPlaceholder="Etapă, județ sau an"
        allSessionsLabel="Toate etapele"
        emptyMessage="Nu există variante pentru filtrele alese."
        sessionLabels={olympiadSessionLabels}
        initialSessionFilter={initialSessionFilter}
        initialSearchParams={filters}
        showProfilePicker={false}
      />
    </>
  );
}
