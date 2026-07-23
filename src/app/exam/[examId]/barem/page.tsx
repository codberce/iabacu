import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound, permanentRedirect } from "next/navigation";
import { RouteLoading } from "@/components/route-loading";

const BaremWorkspace = dynamic(
  () =>
    import("@/components/barem-workspace").then((mod) => mod.BaremWorkspace),
  {
    loading: () => <RouteLoading label="Se încarcă spațiul de lucru" />,
  },
);
import { ExamSeoDetails } from "@/components/exam-seo-details";
import { JsonLd } from "@/components/json-ld";
import {
  getOlympiadWorkspaceByExamId,
  olympiadArchivePath,
} from "@/lib/competitions";
import { getCanonicalExamId, getExamById } from "@/lib/exams";
import { safeReturnPath, withReturnPath } from "@/lib/return-path";
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
  searchParams: Promise<{ from?: string | string[] }>;
};

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: BaremPageProps): Promise<Metadata> {
  const { examId } = await params;
  const olympiadWorkspace = getOlympiadWorkspaceByExamId(examId);
  const exam = olympiadWorkspace?.exam ?? getExamById(examId);
  if (!exam) return {};

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

export default async function BaremPage({ params, searchParams }: BaremPageProps) {
  const { examId } = await params;
  const rawReturnPath = (await searchParams).from;
  const redirectReturnPath = safeReturnPath(rawReturnPath, "/");
  const canonicalExamId = getCanonicalExamId(examId);
  if (canonicalExamId !== examId) {
    permanentRedirect(
      rawReturnPath
        ? withReturnPath(`/exam/${canonicalExamId}/barem`, redirectReturnPath)
        : `/exam/${canonicalExamId}/barem`,
    );
  }
  const olympiadWorkspace = getOlympiadWorkspaceByExamId(examId);
  if (olympiadWorkspace && olympiadWorkspace.exam.id !== examId) {
    permanentRedirect(
      rawReturnPath
        ? withReturnPath(`/exam/${olympiadWorkspace.exam.id}/barem`, redirectReturnPath)
        : `/exam/${olympiadWorkspace.exam.id}/barem`,
    );
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
  const returnPath = safeReturnPath(rawReturnPath, collectionPath);

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
        <BaremWorkspace
          key={exam.id}
          exam={exam}
          backHref={
            returnPath
          }
          subjectHref={withReturnPath(`/exam/${exam.id}`, returnPath)}
        />
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
