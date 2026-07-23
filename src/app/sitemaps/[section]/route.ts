import { notFound } from "next/navigation";
import { olympiadExams } from "@/lib/competitions";
import { bacExams, bacYears, nationalEvaluationExams, nationalEvaluationYears } from "@/lib/exams";
import {
  absoluteUrl,
  baremPagePath,
  examPagePath,
  siteContentUpdatedAt,
  siteUrl,
  subjectSeo,
} from "@/lib/seo";
import { renderSitemap, sitemapHeaders, type SitemapEntry } from "@/lib/sitemap-xml";
import type { Exam } from "@/lib/schemas";
import { olympiadSubjects } from "@/lib/olympiad-subjects";

const sections = ["core.xml", "bac.xml", "evaluare-nationala.xml", "olimpiade.xml"] as const;

function documentEntries(exams: Exam[]): SitemapEntry[] {
  return exams.flatMap((exam) => [
    { loc: absoluteUrl(examPagePath(exam)), changefreq: "yearly" as const, priority: 0.8 },
    { loc: absoluteUrl(baremPagePath(exam)), changefreq: "yearly" as const, priority: 0.7 },
  ]);
}

function coreEntries(): SitemapEntry[] {
  return [
    { loc: siteUrl, lastmod: siteContentUpdatedAt, changefreq: "weekly", priority: 1 },
    { loc: absoluteUrl("/despre"), lastmod: siteContentUpdatedAt, changefreq: "monthly", priority: 0.6 },
    { loc: absoluteUrl("/metodologie"), lastmod: siteContentUpdatedAt, changefreq: "monthly", priority: 0.6 },
    { loc: absoluteUrl("/bacalaureat"), lastmod: siteContentUpdatedAt, changefreq: "weekly", priority: 0.9 },
    { loc: absoluteUrl("/evaluare-nationala"), lastmod: siteContentUpdatedAt, changefreq: "weekly", priority: 0.9 },
    { loc: absoluteUrl("/evaluare-nationala/romana"), lastmod: siteContentUpdatedAt, changefreq: "weekly", priority: 0.8 },
    { loc: absoluteUrl("/evaluare-nationala/matematica"), lastmod: siteContentUpdatedAt, changefreq: "weekly", priority: 0.8 },
    { loc: absoluteUrl("/olimpiade"), lastmod: siteContentUpdatedAt, changefreq: "weekly", priority: 0.9 },
    ...nationalEvaluationYears.map((year) => ({ loc: absoluteUrl(`/evaluare-nationala/${year}`), changefreq: "monthly" as const, priority: 0.8 })),
    ...Object.values(subjectSeo).map((subject) => ({
      loc: absoluteUrl(subject.path),
      lastmod: siteContentUpdatedAt,
      changefreq: "weekly" as const,
      priority: 0.9,
    })),
    ...bacYears.map((year) => ({
      loc: absoluteUrl(`/bacalaureat/${year}`),
      changefreq: "monthly" as const,
      priority: 0.9,
    })),
    ...olympiadSubjects.map((subject) => ({
      loc: absoluteUrl(subject.path),
      lastmod: siteContentUpdatedAt,
      changefreq: "weekly" as const,
      priority: 0.9,
    })),
  ];
}

export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();

  const entries =
    section === "core.xml"
      ? coreEntries()
      : section === "bac.xml"
        ? documentEntries(bacExams)
        : section === "evaluare-nationala.xml"
          ? documentEntries(nationalEvaluationExams)
          : documentEntries(olympiadExams);

  return new Response(renderSitemap(entries), { headers: sitemapHeaders });
}
