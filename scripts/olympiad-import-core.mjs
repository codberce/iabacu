import { createHash } from "node:crypto";

export const STAGES = ["locala", "judeteana", "nationala"];
export const KINDS = ["subject", "solution", "combined"];

const romanGrades = new Map([
  ["v", 5], ["vi", 6], ["vii", 7], ["viii", 8],
  ["ix", 9], ["x", 10], ["xi", 11], ["xii", 12],
]);

const countyNames = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani",
  "Brașov", "Brăila", "București", "Buzău", "Caraș-Severin", "Călărași",
  "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu",
  "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș",
  "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Satu Mare", "Sălaj",
  "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea", "Vaslui", "Vâlcea",
  "Vrancea",
];

export function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function slugify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const countiesBySlug = new Map(countyNames.map((name) => [slugify(name).replaceAll("-", ""), name]));
countiesBySlug.set("bistrita", "Bistrița-Năsăud");
countiesBySlug.set("caras", "Caraș-Severin");
countiesBySlug.set("sector", "București");

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function inferYear(value, fallback) {
  if (Number.isInteger(fallback) && fallback >= 2000 && fallback <= 2099) return fallback;
  const years = [...new Set([...String(value).matchAll(/(?:^|\D)(20\d{2})(?=\D|$)/g)].map((match) => Number(match[1])))];
  return years.length === 1 ? years[0] : undefined;
}

export function inferStage(value, fallback) {
  if (STAGES.includes(fallback)) return fallback;
  const text = normalize(value);
  if (/(?:^|[^a-z])(locala|local|municipiu|sector|etapa[ _.-]*(?:i|1))(?=[^a-z]|$)/.test(text)) return "locala";
  if (/(?:judeteana|judet|ojm|ojf|ojc|etapa[ _.-]*(?:ii|2))/.test(text)) return "judeteana";
  if (/(?:^|[^a-z])(?:nationala|national|onm|onf|onc|finala|etapa[ _.-]*(?:iii|3))(?=[^a-z]|$)/.test(text)) return "nationala";
  return undefined;
}

export function inferGrade(value, fallback) {
  if (Number.isInteger(fallback) && fallback >= 5 && fallback <= 12) return fallback;
  const text = normalize(value);
  const numeric = [...text.matchAll(/(?:clasa|cls|cl)[ _.-]*(?:a[ _.-]*)?(0?[5-9]|1[0-2])(?=\D|$)/g)]
    .map((match) => Number(match[1]));
  const roman = [...text.matchAll(/(?:clasa|cls|cl)[ _.-]*(?:a[ _.-]*)?(xii|viii|vii|vi|xi|ix|v|x)(?=\W|$)/g)]
    .map((match) => romanGrades.get(match[1]));
  const standaloneNumeric = [...text.matchAll(/(?:^|[^0-9])(0?[5-9]|1[0-2])(?=[^0-9]|$)/g)].map((match) => Number(match[1]));
  const standaloneRoman = [...text.matchAll(/(?:^|[^a-z])(xii|viii|vii|vi|xi|ix|v|x)(?=[^a-z]|$)/g)].map((match) => romanGrades.get(match[1]));
  const explicit = [...new Set([...numeric, ...roman])];
  const grades = explicit.length ? explicit : [...new Set([...standaloneNumeric, ...standaloneRoman])];
  return grades.length === 1 ? grades[0] : undefined;
}

export function inferKind(value, fallback) {
  if (KINDS.includes(fallback)) return fallback;
  const text = normalize(value);
  const subject = /(?:^|[^a-z])(?:sb|sub|var|subiecte?|enunturi?|probleme?|test)(?=[^a-z]|$)/.test(text);
  const solution = /(?:^|[^a-z])(?:bar|sol|bareme?|solutii?|rezolvari?|raspunsuri?)(?=[^a-z]|$)/.test(text);
  if (subject && !solution) return "subject";
  if (solution && !subject) return "solution";
  return "combined";
}

export function inferLanguage(value, fallback) {
  if (fallback) return fallback;
  const text = normalize(value);
  const rules = [
    ["hu", /(?:maghiar|magyar|(?:^|[^a-z])lma(?=[^a-z]|$)|_hu\b|\bhu_)/],
    ["de", /(?:german|deutsch|(?:^|[^a-z])lge(?=[^a-z]|$)|_de\b|\bde_)/],
    ["en", /(?:englez|english|_en\b|\ben_)/],
    ["fr", /(?:francez|francais|_fr\b|\bfr_)/],
    ["es", /(?:spaniol|espanol|_es\b|\bes_)/],
    ["it", /(?:italian|_it\b|\bit_)/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? "ro";
}

export function inferCounty(value, fallback) {
  if (fallback) return fallback;
  const sector = normalize(value).match(/(?:sector(?:ul)?)[ _.-]*([1-6])/);
  if (sector) return `București, Sector ${sector[1]}`;
  const text = slugify(value);
  const compactTokens = text.split("-");
  for (let start = 0; start < compactTokens.length; start += 1) {
    for (let length = Math.min(3, compactTokens.length - start); length > 0; length -= 1) {
      const key = compactTokens.slice(start, start + length).join("");
      if (countiesBySlug.has(key)) return countiesBySlug.get(key);
    }
  }
  return undefined;
}

export function inferDocumentMetadata(value, defaults = {}) {
  return {
    olympiadSubject: defaults.olympiadSubject ?? defaults.subject,
    stage: inferStage(value, defaults.stage),
    year: inferYear(value, defaults.year),
    grade: inferGrade(value, defaults.grade),
    kind: inferKind(value, defaults.kind),
    language: inferLanguage(value, defaults.language),
    county: inferCounty(value, defaults.county),
  };
}

export function validateCatalog(catalog) {
  const errors = [];
  if (catalog?.version !== 2) errors.push("Catalog version must be 2.");
  if (!Array.isArray(catalog?.subjects) || catalog.subjects.length === 0) errors.push("Catalog subjects must be a non-empty array.");
  if (!Array.isArray(catalog?.sources)) errors.push("Catalog sources must be an array.");
  const subjectIds = new Set();
  for (const subject of catalog?.subjects ?? []) {
    if (!subject.id || !subject.label) errors.push("Every subject needs id and label.");
    if (subjectIds.has(subject.id)) errors.push(`Duplicate subject id: ${subject.id}`);
    subjectIds.add(subject.id);
    for (const stage of STAGES) {
      if (!subject.coverage?.[stage]?.status) errors.push(`${subject.id}: missing explicit ${stage} coverage status.`);
    }
  }
  const sourceIds = new Set();
  for (const source of catalog?.sources ?? []) {
    if (!source.id || !source.adapter) errors.push("Every source needs id and adapter.");
    if (sourceIds.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
    if (!subjectIds.has(source.subject)) errors.push(`${source.id}: unknown subject ${source.subject}.`);
    if (source.stage && !STAGES.includes(source.stage)) errors.push(`${source.id}: invalid stage ${source.stage}.`);
    if (source.adapter !== "unavailable" && !source.url && !source.path && !source.urlTemplate) {
      errors.push(`${source.id}: source adapter requires url, path, or urlTemplate.`);
    }
    if (source.adapter === "html-paginated-search" && !source.titlePattern) {
      errors.push(`${source.id}: html-paginated-search requires titlePattern.`);
    }
    if (!source.provenance?.publisher || !source.provenance?.label) errors.push(`${source.id}: provenance publisher and label are required.`);
  }
  return errors;
}

function semanticKey(document) {
  return [document.olympiadSubject, document.stage, document.year, document.county ?? "", document.grade ?? "", document.kind, document.language, document.pairKey, document.sha256].join(":");
}

export function inferPairKey(value, metadata, fallback) {
  if (fallback) return fallback;
  const variantStem = slugify(
    String(value)
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/(?:^|[^a-z])(?:sb|sub|var|bar|sol|subiecte?|enunturi?|bareme?|solutii?|rezolvari?|raspunsuri?)(?=[^a-z]|$)/gi, " ")
      .replace(/(?:clasa|cls|cl)[ _.-]*(?:a[ _.-]*)?(?:0?[5-9]|1[0-2]|xii|viii|vii|vi|xi|ix|v|x)/gi, " ")
      .replace(/\b20\d{2}\b/g, " ")
      .replace(/(?:judeteana|judet|locala|local|nationala|national)/gi, " "),
  ) || "standard";
  return [
    metadata.olympiadSubject, metadata.stage, metadata.year, metadata.county,
    metadata.grade && `clasa-${metadata.grade}`, metadata.language, variantStem,
  ].filter(Boolean).map(slugify).join(":");
}

export function deduplicateDocuments(documents) {
  const unique = new Map();
  for (const document of documents) {
    const key = semanticKey(document);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, { ...document, provenance: [...document.provenance] });
      continue;
    }
    for (const provenance of document.provenance) {
      if (!existing.provenance.some((item) => item.sourceUrl === provenance.sourceUrl && item.sourceId === provenance.sourceId)) {
        existing.provenance.push(provenance);
      }
    }
  }
  return [...unique.values()];
}


// Subjects whose documents live outside this index (e.g. legacy mathematics)
// and therefore stay declared as catalogued regardless of the per-stage count.
export const LEGACY_DOCUMENT_SUBJECTS = new Set(["matematica"]);

export function findEmptyCataloguedStages(documents, coverage = [], { preservedSubjects = LEGACY_DOCUMENT_SUBJECTS } = {}) {
  const counts = new Map();
  for (const document of documents ?? []) {
    const key = `${document.olympiadSubject}|${document.stage}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const empty = [];
  for (const entry of coverage ?? []) {
    if (entry?.status !== "catalogued") continue;
    if (preservedSubjects.has(entry.olympiadSubject)) continue;
    if ((counts.get(`${entry.olympiadSubject}|${entry.stage}`) ?? 0) === 0) {
      empty.push({ olympiadSubject: entry.olympiadSubject, stage: entry.stage });
    }
  }
  return empty;
}

export function buildManifest({ documents, outcomes, coverage = [], catalogVersion, assetBaseUrl = "/olimpiade", generatedAt = new Date().toISOString() }) {
  const deduplicated = deduplicateDocuments(documents);
  const assets = [...new Map(deduplicated.map((document) => [document.sha256, {
    sha256: document.sha256,
    size: document.size,
    assetKey: document.assetKey,
  }])).values()];
  const contentGroups = new Map();
  for (const document of deduplicated) contentGroups.set(document.sha256, [...(contentGroups.get(document.sha256) ?? []), document.id]);
  // Source-level outcomes stay in `sources`; failed/unavailable outcomes are also surfaced
  // as gaps so callers can see per-source failures without losing the stage-level picture.
  const sourceGaps = outcomes.filter((outcome) => ["failed", "unavailable"].includes(outcome.status));
  // Stage-specific coverage gaps are always emitted for any stage declared unavailable.
  // They do NOT replace or hide failed source gaps: a single stage can have both
  // (the user-facing unavailability note AND the operational source failure detail).
  const coverageGaps = coverage
    .filter((entry) => entry.status === "unavailable")
    .map((entry) => ({
      olympiadSubject: entry.olympiadSubject,
      stage: entry.stage,
      status: "unavailable",
      reason: entry.note ?? "No audited source is catalogued.",
    }));
  return {
    version: 2,
    catalogVersion,
    generatedAt,
    assetBaseUrl,
    coverage,
    documents: deduplicated,
    assets,
    duplicateContentGroups: [...contentGroups.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([digest, documentIds]) => ({ sha256: digest, documentIds })),
    sources: outcomes,
    gaps: [...sourceGaps, ...coverageGaps],
  };
}
