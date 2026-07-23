import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { OlympiadSubjectPicker } from "@/components/olympiad-subject-picker";
import { olympiadSubjects } from "@/lib/olympiad-subjects";
import { absoluteUrl, createPageMetadata, siteName, siteUrl } from "@/lib/seo";

const title = "Olimpiade școlare: subiecte și bareme";
const description =
  "Alege disciplina și găsește subiecte și bareme de la olimpiadele școlare.";
const path = "/olimpiade";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  keywords: ["olimpiade școlare", "subiecte olimpiadă", "bareme olimpiadă"],
});

export default function OlympiadsPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Olimpiade",
          description,
          url: absoluteUrl(path),
          isPartOf: {
            "@type": "WebSite",
            name: siteName,
            url: siteUrl,
          },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: olympiadSubjects.length,
            itemListElement: olympiadSubjects.map((subject, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: subject.name,
              url: absoluteUrl(subject.path),
            })),
          },
        }}
      />
      <OlympiadSubjectPicker />
    </>
  );
}
