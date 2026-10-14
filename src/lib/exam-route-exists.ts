import examIds from "@/data/exam-route-ids.json";

const knownIds = new Set(examIds);

export function isKnownExamRoute(pathname: string): boolean | null {
  const match = pathname.match(/^\/exam\/([^/]+)(?:\/barem)?\/?$/);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]);
    // These use a dedicated redirect handler, which validates the old ID.
    if (/^olympiad:(5|6|7|8|9|10|11|12):/.test(id)) return true;
    return knownIds.has(id);
  } catch {
    return false;
  }
}
