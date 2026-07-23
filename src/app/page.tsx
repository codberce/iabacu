import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { SubjectPicker } from "@/components/subject-picker";
import {
  absoluteUrl,
  createPageMetadata,
  defaultDescription,
  defaultTitle,
  siteName,
  siteUrl,
  subjectSeo,
} from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: defaultTitle,
  description: defaultDescription,
  path: "/",
});

export default function Home() {
  const subjects = Object.values(subjectSeo);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${siteUrl}/#website`,
              name: siteName,
              alternateName: ["iabacu.ro", "IABACU"],
              url: siteUrl,
              inLanguage: "ro-RO",
              description: defaultDescription,
              publisher: { "@id": `${siteUrl}/#organization` },
            },
            {
              "@type": "Organization",
              "@id": `${siteUrl}/#organization`,
              name: siteName,
              alternateName: "iabacu.ro",
              url: siteUrl,
              logo: absoluteUrl("/favicon.ico"),
              sameAs: ["https://github.com/codberce/iabacu"],
              publishingPrinciples: absoluteUrl("/metodologie"),
            },
            {
              "@type": "ItemList",
              name: "Materii bacalaureat disponibile pe iabacu",
              itemListElement: subjects.map((subject, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: subject.name,
                url: absoluteUrl(subject.path),
              })),
            },
          ],
        }}
      />
      <SubjectPicker />
    </>
  );
}
