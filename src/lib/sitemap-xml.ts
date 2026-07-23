export type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderSitemap(entries: SitemapEntry[]) {
  const urls = entries
    .map(
      (entry) =>
        `<url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""}${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ""}${entry.priority == null ? "" : `<priority>${entry.priority.toFixed(1)}</priority>`}</url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function renderSitemapIndex(sitemaps: SitemapEntry[]) {
  const entries = sitemaps
    .map(
      (sitemap) =>
        `<sitemap><loc>${escapeXml(sitemap.loc)}</loc>${sitemap.lastmod ? `<lastmod>${escapeXml(sitemap.lastmod)}</lastmod>` : ""}</sitemap>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

export const sitemapHeaders = {
  "content-type": "application/xml; charset=utf-8",
  "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
} as const;
