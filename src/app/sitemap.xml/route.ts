import { absoluteUrl, siteContentUpdatedAt } from "@/lib/seo";
import { renderSitemapIndex, sitemapHeaders } from "@/lib/sitemap-xml";

export function GET() {
  return new Response(
    renderSitemapIndex(
      ["core", "bac", "evaluare-nationala", "olimpiade"].map((section) => ({
        loc: absoluteUrl(`/sitemaps/${section}.xml`),
        lastmod: siteContentUpdatedAt,
      })),
    ),
    { headers: sitemapHeaders },
  );
}
