import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound, permanentRedirect } from "next/navigation";
import { RouteLoading } from "@/components/route-loading";

const ExamWorkspace = dynamic(
  () =>
    import("@/components/exam-workspace").then((mod) => mod.ExamWorkspace),
  {
    loading: () => <RouteLoading label="Se încarcă spațiul de lucru" />,
  },
);
import { ExamSeoDetails } from "@/components/exam-seo-details";
import { JsonLd } from "@/components/json-ld";
import {
  getOlympiadWorkspaceByExamId,
  olympiadArchivePathForSubject,
  parseOlympiadGrade,
} from "@/lib/competitions";
import { getCanonicalExamId, getExamById } from "@/lib/exams";
import { getOlympiadSubject } from "@/lib/olympiad-subjects";
import { safeReturnPath, withReturnPath } from "@/lib/return-path";
import {
  absoluteUrl,
  bacExamTitle,
  createPageMetadata,
  examDescription,
  examPagePath,
  siteName,
  siteUrl,
  subjectSeo,
  olympiadExamTitle,
} from "@/lib/seo";

type ExamPageProps = {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: ExamPageProps): Promise<Metadata> {
  const { examId } = await params;
  const olympiadWorkspace = getOlympiadWorkspaceByExamId(examId);
  const exam = olympiadWorkspace?.exam ?? getExamById(examId);
  if (!exam) return {};
  const olympiadSubject = getOlympiadSubject(exam.olympiadSubject ?? "");
  const olympiadGrade = olympiadWorkspace?.grade ?? parseOlympiadGrade(exam.profile.match(/clasa a (\d+)-a/i)?.[1]);

  if (olympiadSubject && olympiadGrade) {
    const platformName = exam.platform && olympiadSubject.mode === "platform"
      ? olympiadSubject.platformName
      : undefined;
    return createPageMetadata({
      title: exam.platform
        ? `Probă ${olympiadSubject.olympiadName} ${exam.year} – clasa a ${olympiadGrade}-a, ${exam.sessionLabel}`
        : olympiadExamTitle(exam, olympiadGrade, "subject"),
      description: exam.platform
        ? `${exam.sessionLabel}, clasa a ${olympiadGrade}-a: probă pe ${platformName} și rezultat salvat în iabacu.`
        : `${exam.sessionLabel}, clasa a ${olympiadGrade}-a: subiect, barem PDF și corectare AI.`,
      path: examPagePath(exam),
      keywords: [
        ...(exam.platform
          ? [
              `probă ${olympiadSubject.olympiadName.toLocaleLowerCase("ro")}`,
              platformName?.toLocaleLowerCase("ro") ?? "",
            ]
          : [`subiect ${olympiadSubject.olympiadName.toLocaleLowerCase("ro")}`]),
        `${olympiadSubject.olympiadName.toLocaleLowerCase("ro")} ${exam.year}`,
        `clasa a ${olympiadGrade}-a`,
        exam.sessionLabel,
      ],
    });
  }

  const subject = subjectSeo[exam.subject];
  const isNationalEvaluation = exam.category === "evaluare-nationala";
  return createPageMetadata({
    title: isNationalEvaluation ? `${subject.shortName} Evaluarea Națională ${exam.title}` : bacExamTitle(exam, "subject"),
    description: isNationalEvaluation ? `${exam.sessionLabel}: subiect, barem și corectare pentru Evaluarea Națională, clasa a VIII-a.` : examDescription(exam),
    path: examPagePath(exam),
    keywords: [
      `subiect bac ${subject.shortName.toLocaleLowerCase("ro")}`,
      `barem bac ${subject.shortName.toLocaleLowerCase("ro")}`,
      `bac ${exam.year}`,
      exam.sessionLabel,
    ],
  });
}

export default async function ExamPage({ params, searchParams }: ExamPageProps) {
  const { examId } = await params;
  const rawReturnPath = (await searchParams).from;
  const redirectReturnPath = safeReturnPath(rawReturnPath, "/");
  const canonicalExamId = getCanonicalExamId(examId);
  if (canonicalExamId !== examId) {
    permanentRedirect(
      rawReturnPath
        ? withReturnPath(`/exam/${canonicalExamId}`, redirectReturnPath)
        : `/exam/${canonicalExamId}`,
    );
  }
  const olympiadWorkspace = getOlympiadWorkspaceByExamId(examId);
  if (olympiadWorkspace && olympiadWorkspace.exam.id !== examId) {
    permanentRedirect(
      rawReturnPath
        ? withReturnPath(`/exam/${olympiadWorkspace.exam.id}`, redirectReturnPath)
        : `/exam/${olympiadWorkspace.exam.id}`,
    );
  }
  const exam = olympiadWorkspace?.exam ?? getExamById(examId);
  if (!exam) notFound();

  const subject = subjectSeo[exam.subject];
  const olympiadSubject = getOlympiadSubject(exam.olympiadSubject ?? "");
  const olympiadGrade = olympiadWorkspace?.grade ?? parseOlympiadGrade(exam.profile.match(/clasa a (\d+)-a/i)?.[1]);
  const isOlympiad = Boolean(olympiadSubject && olympiadGrade);
  const isNationalEvaluation = exam.category === "evaluare-nationala";
  const collectionName = isOlympiad
    ? olympiadSubject!.olympiadName
    : isNationalEvaluation ? "Evaluarea Națională" : subject.name;
  const collectionPath = isOlympiad
    ? olympiadArchivePathForSubject(olympiadSubject!.id, olympiadGrade)
    : isNationalEvaluation ? `/evaluare-nationala/${exam.subject}` : subject.path;
  const pageName = isOlympiad
    ? exam.platform
      ? `Probă ${olympiadSubject!.olympiadName} ${exam.year} – clasa a ${olympiadGrade}-a, ${exam.sessionLabel}`
      : exam.title
    : isNationalEvaluation ? `${subject.shortName} Evaluarea Națională ${exam.title}` : `${subject.shortName} bac ${exam.title}`;
  const platformName = isOlympiad && exam.platform && olympiadSubject!.mode === "platform"
    ? olympiadSubject!.platformName
    : null;
  const description = isOlympiad
    ? exam.platform
      ? `${exam.sessionLabel}, clasa a ${olympiadGrade}-a: probă pe ${platformName} și rezultat salvat în iabacu.`
      : `${exam.sessionLabel}, clasa a ${olympiadGrade}-a: subiect, barem PDF și corectare AI.`
    : isNationalEvaluation ? `${exam.sessionLabel}: subiect, barem și corectare pentru Evaluarea Națională, clasa a VIII-a.` : examDescription(exam);
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
              url: absoluteUrl(examPagePath(exam)),
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
              ],
            },
            {
              "@type": "LearningResource",
              name: pageName,
              description,
              url: absoluteUrl(examPagePath(exam)),
              inLanguage: "ro-RO",
              educationalLevel: isNationalEvaluation ? "Clasa a VIII-a" : "Liceu",
              learningResourceType: "Exam",
              about: collectionName,
              isBasedOn: exam.sourceUrl,
              hasPart: exam.platform ? undefined : [
                {
                  "@type": "DigitalDocument",
                  name: `Subiect ${exam.title}`,
                  encodingFormat: "application/pdf",
                  url: absoluteUrl(exam.examPdfPath),
                },
                {
                  "@type": "DigitalDocument",
                  name: `Barem ${exam.title}`,
                  encodingFormat: "application/pdf",
                  url: absoluteUrl(exam.baremPdfPath),
                },
              ],
            },
          ],
        }}
      />
      <main>
        <ExamWorkspace
          key={exam.id}
          exam={exam}
          backHref={
            returnPath
          }
          baremHref={withReturnPath(`/exam/${exam.id}/barem`, returnPath)}
        />
        <ExamSeoDetails
          exam={exam}
          documentKind="subject"
          yearHubPath={
            isOlympiad
              ? `${olympiadArchivePathForSubject(olympiadSubject!.id, olympiadGrade)}&year=${exam.year}`
              : isNationalEvaluation
                ? `/evaluare-nationala/${exam.subject}?year=${exam.year}`
                : `/${exam.subject}?year=${exam.year}`
          }
        />
      </main>
    </>
  );
}
