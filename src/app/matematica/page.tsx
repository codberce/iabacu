import type { Metadata } from "next";
import { ExamGrid, type ExamGridSearchParams } from "@/components/exam-grid";
import { JsonLd } from "@/components/json-ld";
import { examsBySubject } from "@/lib/exams";
import { absoluteUrl, createPageMetadata, siteName, siteUrl, subjectSeo } from "@/lib/seo";

const subject = subjectSeo.matematica;

export const metadata: Metadata = createPageMetadata({
  title: subject.title,
  description: subject.description,
  path: subject.path,
  keywords: subject.keywords,
});

export default async function MathematicsPage({
  searchParams,
}: {
  searchParams: Promise<ExamGridSearchParams>;
}) {
  const exams = examsBySubject.matematica ?? [];
  const filters = await searchParams;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: subject.title,
          description: subject.description,
          url: absoluteUrl(subject.path),
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
        subject="matematica"
        title={subject.shortName}
        archiveHref={subject.path}
        initialSearchParams={filters}
        showProfilePicker
      />
    </>
  );
}
