import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamGrid, type ExamGridSearchParams } from "@/components/exam-grid";
import { JsonLd } from "@/components/json-ld";
import { examsBySubject } from "@/lib/exams";
import {
  absoluteUrl,
  createPageMetadata,
  siteName,
  siteUrl,
  subjectSeo,
} from "@/lib/seo";
import type { Exam } from "@/lib/schemas";

const dynamicSubjects = ["istorie", "biologie", "chimie", "geografie", "logica", "psihologie", "sociologie", "economie", "filosofie"] as const;

export function generateStaticParams() {
  return dynamicSubjects.map((subject) => ({ subject }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>;
}): Promise<Metadata> {
  const { subject } = await params;
  const seo = subjectSeo[subject as Exam["subject"]];
  return seo
    ? createPageMetadata({
        title: seo.title,
        description: seo.description,
        path: seo.path,
        keywords: seo.keywords,
      })
    : {};
}

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string }>;
  searchParams: Promise<ExamGridSearchParams>;
}) {
  const { subject } = await params;
  if (!dynamicSubjects.includes(subject as (typeof dynamicSubjects)[number])) notFound();
  const typedSubject = subject as Exam["subject"];
  const seo = subjectSeo[typedSubject];
  const exams = examsBySubject[typedSubject] ?? [];
  const filters = await searchParams;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: seo.title,
          description: seo.description,
          url: absoluteUrl(seo.path),
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
        exams={exams}
        subject={typedSubject}
        title={seo.shortName}
        archiveHref={seo.path}
        initialSearchParams={filters}
      />
    </>
  );
}
