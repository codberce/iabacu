import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { RouteLoading } from "@/components/route-loading";

import { BaremRouteWorkspace } from "@/components/exam-route-workspace";
import { ExamSeoDetails } from "@/components/exam-seo-details";
import { JsonLd } from "@/components/json-ld";
import {
  getOlympiadWorkspaceByExamId,
  olympiadArchivePath,
} from "@/lib/competitions";
import { exams, getCanonicalExamId, getExamById } from "@/lib/exams";
import {
  absoluteUrl,
  bacExamTitle,
  baremDescription,
  baremPagePath,
  createPageMetadata,
  examPagePath,
  siteName,
  siteUrl,
  subjectSeo,
  olympiadExamTitle,
} from "@/lib/seo";

type BaremPageProps = {
  params: Promise<{ examId: string }>;
};

// The archive is deployed with the application. Render known IDs at build
// time so neither page rendering nor visitor query context enters runtime ISR.
export const dynamicParams = false;

export function generateStaticParams() {
  return exams.map((exam) => ({ examId: exam.id }));
}

export async function generateMetadata({
  params,
}: BaremPageProps): Promise<Metadata> {
  const { examId } = await params;
  const olympiadWorkspace = getOlympiadWorkspaceByExamId(examId);
  const exam = olympiadWorkspace?.exam ?? getExamById(examId);
  if (!exam) notFound();

  if (olympiadWorkspace) {
    return createPageMetadata({
      title: olympiadExamTitle(exam, olympiadWorkspace.grade, "barem"),
      description: `Barem și soluții pentru ${exam.sessionLabel}, clasa a ${olympiadWorkspace.grade}-a, cu explicații AI.`,
      path: baremPagePath(exam),
      keywords: [
        "barem olimpiada matematica",
        "solutii olimpiada matematica",
        `olimpiada matematica ${exam.year}`,
        `clasa a ${olympiadWorkspace.grade}-a`,
        exam.sessionLabel,
      ],
    });
  }

  const subject = subjectSeo[exam.subject];
  const isNationalEvaluation = exam.category === "evaluare-nationala";
  return createPageMetadata({
    title: isNationalEvaluation ? `Barem ${subject.shortName} Evaluarea Națională ${exam.title}` : bacExamTitle(exam, "barem"),
    description: isNationalEvaluation ? `Barem pentru ${exam.sessionLabel}, Evaluarea Națională, clasa a VIII-a.` : baremDescription(exam),
    path: baremPagePath(exam),
    keywords: [
      `barem bac ${subject.shortName.toLocaleLowerCase("ro")}`,
      `rezolvare bac ${subject.shortName.toLocaleLowerCase("ro")}`,
      `bac ${exam.year}`,
      exam.sessionLabel,
    ],
  });
}

export default async function BaremPage({ params }: BaremPageProps) {
  const { examId } = await params;
  const canonicalExamId = getCanonicalExamId(examId);
  if (canonicalExamId !== examId) {
    permanentRedirect(`/exam/${canonicalExamId}/barem`);
  }
  const olympiadWorkspace = getOlympiadWorkspaceByExamId(examId);
  if (olympiadWorkspace && olympiadWorkspace.exam.id !== examId) {
    permanentRedirect(`/exam/${olympiadWorkspace.exam.id}/barem`);
  }
  const exam = olympiadWorkspace?.exam ?? getExamById(examId);
  if (!exam) notFound();

  const subject = subjectSeo[exam.subject];
  const isNationalEvaluation = exam.category === "evaluare-nationala";
  const collectionName = olympiadWorkspace
    ? "Olimpiada de Matematică"
    : isNationalEvaluation ? "Evaluarea Națională" : subject.name;
  const collectionPath = olympiadWorkspace
    ? olympiadArchivePath(olympiadWorkspace.grade)
    : isNationalEvaluation ? `/evaluare-nationala/${exam.subject}` : subject.path;
  const description = olympiadWorkspace
    ? `Barem și soluții pentru ${exam.sessionLabel}, clasa a ${olympiadWorkspace.grade}-a, cu explicații AI.`
    : isNationalEvaluation ? `Barem pentru ${exam.sessionLabel}, Evaluarea Națională, clasa a VIII-a.` : baremDescription(exam);
  const pageName = olympiadWorkspace
    ? `Barem ${exam.title}`
    : isNationalEvaluation ? `Barem ${subject.shortName} Evaluarea Națională ${exam.title}` : `Barem ${subject.shortName} bac ${exam.title}`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              name: pageName,
              description,
              url: absoluteUrl(baremPagePath(exam)),
              inLanguage: "ro-RO",
              isPartOf: {
                "@type": "WebSite",
                name: siteName,
                url: siteUrl,
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Acasă",
                  item: siteUrl,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: collectionName,
                  item: absoluteUrl(collectionPath),
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: exam.title,
                  item: absoluteUrl(examPagePath(exam)),
                },
                {
                  "@type": "ListItem",
                  position: 4,
                  name: "Barem",
                  item: absoluteUrl(baremPagePath(exam)),
                },
              ],
            },
            {
              "@type": "DigitalDocument",
              name: pageName,
              description,
              encodingFormat: "application/pdf",
              url: absoluteUrl(exam.baremPdfPath),
              inLanguage: "ro-RO",
              about: collectionName,
              isBasedOn: exam.baremSourceUrl,
            },
          ],
        }}
      />
      <main>
        <Suspense fallback={<RouteLoading label="Se încarcă spațiul de lucru" />}>
          <BaremRouteWorkspace key={exam.id} exam={exam} collectionPath={collectionPath} />
        </Suspense>
        <ExamSeoDetails
          exam={exam}
          documentKind="barem"
          yearHubPath={
            olympiadWorkspace
              ? `/olimpiade/olimpiada-de-matematica?clasa=${olympiadWorkspace.grade}&year=${exam.year}`
              : isNationalEvaluation
                ? `/evaluare-nationala/${exam.subject}?year=${exam.year}`
                : `/${exam.subject}?year=${exam.year}`
          }
        />
      </main>
    </>
  );
}
