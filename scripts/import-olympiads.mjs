import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildManifest, inferCounty, inferDocumentMetadata, inferPairKey, inferYear,
  sha256, slugify, validateCatalog,
} from "./olympiad-import-core.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptRoot, "..");
const defaultCatalogPath = path.join(scriptRoot, "olympiad-sources.json");
const defaultManifestPath = path.join(projectRoot, "src", "data", "olympiad-subject-index.json");
const defaultAssetRoot = path.join(projectRoot, "public", "olimpiade");

function option(name, fallback) {
  const argument = process.argv.find((item) => item.startsWith(`${name}=`));
  return argument ? argument.slice(name.length + 1) : fallback;
}

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => {
      const num = Number(code);
      return Number.isFinite(num) ? String.fromCodePoint(num) : `&#${code};`;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const num = Number.parseInt(code, 16);
      return Number.isFinite(num) ? String.fromCodePoint(num) : `&#x${code};`;
    })
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&ndash;", "–")
    .replaceAll("&mdash;", "—")
    .replaceAll("&hellip;", "…")
    .replaceAll("&laquo;", "«")
    .replaceAll("&raquo;", "»")
    .replaceAll("&bdquo;", "„")
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

const romanGradeMap = { v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

function parseRowTitleMetadata(title) {
  const text = String(title ?? "").trim();
  if (!text) return undefined;
  if (/^regulament/i.test(text)) return undefined;

  let kind;
  if (/^barem(e|ul)?\b/i.test(text) && !/subiect/i.test(text)) kind = "solution";
  else if (/^subiect(e|ul)?\b/i.test(text) && !/barem/i.test(text)) kind = "subject";
  else if (/subiect\s+[șş]i\s+barem/i.test(text) || /subiect\s+si\s+barem/i.test(text)) kind = "combined";
  else return undefined;

  let stage;
  if (/etapa\s+na[țţt]ional[ăa]|faza\s+na[țţt]ional[ăa]/i.test(text)) stage = "nationala";
  else if (/etapa\s+jude[țţt]ean[ăa]|faza\s+jude[țţt]ean[ăa]/i.test(text)) stage = "judeteana";
  else if (/etapa\s+local[ăa]|faza\s+local[ăa]|etapa\s+pe\s+[șş]coal[ăa]/i.test(text)) stage = "locala";
  else return undefined;

  const single = text.match(/\bclasa\s+a\s+(V|VI|VII|VIII|IX|X|XI|XII)\b/i);
  if (single) return { kind, stage, grade: romanGradeMap[single[1].toLowerCase()], gradeRange: undefined };

  const range = text.match(/\bclasele?\s+(V|VI|VII|VIII|IX|X|XI|XII)\s*[-–]\s*(V|VI|VII|VIII|IX|X|XI|XII)\b/i);
  if (range) {
    const start = romanGradeMap[range[1].toLowerCase()];
    const end = romanGradeMap[range[2].toLowerCase()];
    if (Number.isInteger(start) && Number.isInteger(end) && start <= end) {
      return { kind, stage, grade: undefined, gradeRange: [start, end] };
    }
  }

  return { kind, stage, grade: undefined, gradeRange: undefined };
}

function gradeRangeLabel(range) {
  if (!range) return undefined;
  const [start, end] = range;
  if (start === end) return `Clasa a ${start}-a`;
  const labels = { 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII" };
  return `Clasele a ${labels[start]}-a – a ${labels[end]}-a`;
}

function anchors(html, baseUrl) {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    try {
      return [{ url: new URL(decodeHtml(match[1]), baseUrl).toString(), title: decodeHtml(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) }];
    } catch {
      return [];
    }
  });
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(item));
    else files.push(item);
  }
  return files;
}

async function download(url, cache) {
  if (cache.has(url)) return cache.get(url);
  const promise = (async () => {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "iabacu-olympiad-import/3.0 (+https://iabacu.ro)" },
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  })();
  cache.set(url, promise);
  return promise;
}

function expandTemplate(source) {
  const dimensions = Object.entries(source.dimensions ?? {});
  let combinations = [{}];
  for (const [name, values] of dimensions) combinations = combinations.flatMap((combination) => values.map((value) => ({ ...combination, [name]: value })));
  return combinations.map((values, index) => ({
    ...source,
    id: `${source.id}-${Object.values(values).join("-") || index + 1}`,
    adapter: "direct",
    ...values,
    url: source.urlTemplate.replace(/\{(\w+)\}/g, (_, name) => source.valueMaps?.[name]?.[values[name]] ?? values[name]),
    parentSourceId: source.id,
  }));
}

async function expandSource(source, cache) {
  if (source.adapter === "unavailable") return [];
  if (source.adapter === "template") return expandTemplate(source);
  if (source.adapter === "direct") return [source];
  if (source.adapter === "html-links") {
    const html = (await download(source.url, cache)).toString("utf8");
    const include = new RegExp(source.hrefPattern, source.caseSensitive ? "" : "i");
    const exclude = source.excludePattern ? new RegExp(source.excludePattern, "i") : undefined;
    return anchors(html, source.url)
      .filter((link) => include.test(link.url) && !exclude?.test(link.url))
      .map((link, index) => ({ ...source, id: `${source.id}-${index + 1}`, adapter: "direct", catalogueUrl: source.catalogueUrl ?? source.url, url: link.url, catalogueEntryTitle: link.title || undefined, parentSourceId: source.id }));
  }
  if (source.adapter === "html-paginated-search") {
    const firstHtml = (await download(source.url, cache)).toString("utf8");
    const pageNumbers = [...firstHtml.matchAll(/[?&]page=(\d+)/g)].map((match) => Number(match[1]));
    const lastPage = Math.max(1, ...pageNumbers);
    const pageUrls = Array.from({ length: lastPage }, (_, index) => {
      const url = new URL(source.url);
      url.searchParams.set("tab", "materiale");
      url.searchParams.set("page", String(index + 1));
      return url.toString();
    });
    const pages = await mapWithConcurrency(pageUrls, 10, async (url, index) =>
      index === 0 ? firstHtml : (await download(url, cache)).toString("utf8"),
    );
    const titlePattern = new RegExp(source.titlePattern, "i");
    const materialLinks = new Map();
    for (const html of pages) {
      for (const link of anchors(html, source.url)) {
        if (!new URL(link.url).pathname.startsWith("/materiale/")) continue;
        if (link.url.includes("#comentarii")) continue;
        if (!titlePattern.test(link.title)) continue;
        if (!/(?:etapa|faza).*(?:local|jude|na[țţt]ional)/i.test(link.title)) continue;
        if (!/(?:subiect|barem|solu[țţt]|rezolvare)/i.test(link.title)) continue;
        materialLinks.set(link.url, link.title);
      }
    }
    const details = await mapWithConcurrency([...materialLinks], 10, async ([detailUrl, title], index) => {
      const html = (await download(detailUrl, new Map())).toString("utf8");
      const pdf = anchors(html, detailUrl).find((link) => /static\.olimpiade\.ro\/.*\.pdf(?:[?#]|$)/i.test(link.url));
      return pdf ? {
        ...source,
        id: `${source.id}-${index + 1}`,
        adapter: "direct",
        url: pdf.url,
        title,
        catalogueUrl: detailUrl,
        parentSourceId: source.id,
      } : undefined;
    });
    return details.filter(Boolean);
  }
  if (source.adapter === "html-row-downloads") {
    const html = (await download(source.url, cache)).toString("utf8");
    const stageOverride = source.stageMap ?? {};
    const olympiadName = source.olympiadName ?? "Olimpiada de Istorie";
    const rowPattern = /<tr\b[^>]*post-row\b[\s\S]*?<\/tr>/gi;
    const rowMatches = [...html.matchAll(rowPattern)];
    const discovered = [];
    let counter = 0;
    for (const rowMatch of rowMatches) {
      const rowHtml = rowMatch[0];
      const titleMatch = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      if (!titleMatch) continue;
      const title = decodeHtml(titleMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      const linkMatch = rowHtml.match(/<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>/i);
      if (!linkMatch) continue;
      const linkAttrs = `${linkMatch[1]} ${linkMatch[3]}`;
      if (!/\bdlp-download-link\b/.test(linkAttrs)) continue;
      let pdfUrl;
      try {
        pdfUrl = new URL(decodeHtml(linkMatch[2]), source.url).toString();
      } catch {
        continue;
      }
      if (!/\.pdf(?:[?#]|$)/i.test(pdfUrl)) continue;
      const metadata = parseRowTitleMetadata(title);
      if (!metadata) continue;
      const stage = stageOverride[metadata.stage] ?? metadata.stage;
      counter += 1;
      const kindLabel = metadata.kind === "solution" ? "Barem" : metadata.kind === "subject" ? "Subiect" : "Subiect și barem";
      const stageLabel = stage === "nationala" ? "Etapa națională" : stage === "judeteana" ? "Etapa județeană" : "Etapa locală";
      const rangeLabel = gradeRangeLabel(metadata.gradeRange);
      const singleLabel = Number.isInteger(metadata.grade) ? `Clasa a ${metadata.grade}-a` : null;
      const gradeLabel = singleLabel ?? rangeLabel;
      const titleParts = [kindLabel, olympiadName, String(source.year ?? "").trim()].filter(Boolean);
      const composedTitle = gradeLabel
        ? `${titleParts.join(" ")}, ${gradeLabel}, ${stageLabel}`
        : `${titleParts.join(" ")}, ${stageLabel}`;
      const explicit = { title: composedTitle };
      if (metadata.kind) explicit.kind = metadata.kind;
      if (stage) explicit.stage = stage;
      if (Number.isInteger(metadata.grade)) explicit.grade = metadata.grade;
      if (Number.isInteger(source.year)) explicit.year = source.year;
      discovered.push({
        ...source,
        ...explicit,
        ...(metadata.gradeRange && !Number.isInteger(metadata.grade) ? { gradeRange: metadata.gradeRange } : {}),
        id: `${source.id}-${counter}`,
        adapter: "direct",
        url: pdfUrl,
        catalogueUrl: source.url,
        catalogueEntryTitle: title,
        parentSourceId: source.id,
      });
    }
    return discovered;
  }
  throw new Error(`Unknown adapter: ${source.adapter}`);
}

async function mapWithConcurrency(items, concurrency, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  }));
  return output;
}

function extractArchive(buffer, source, workRoot) {
  const pathname = new URL(source.url).pathname;
  const extension = path.extname(pathname) || ".zip";
  const archivePath = path.join(workRoot, `source${extension}`);
  return writeFile(archivePath, buffer).then(async () => {
    const output = path.join(workRoot, "contents");
    await mkdir(output, { recursive: true });
    execFileSync("7z", ["x", "-y", `-o${output}`, archivePath], { stdio: "ignore", timeout: 120_000 });
    return (await walk(output)).filter((file) => file.toLowerCase().endsWith(".pdf"));
  });
}

function provenanceFor(source) {
  return {
    sourceId: source.id,
    ...(source.parentSourceId ? { parentSourceId: source.parentSourceId } : {}),
    sourceUrl: source.url,
    catalogueUrl: source.catalogueUrl ?? (source.adapter === "direct" ? undefined : source.url),
    publisher: source.provenance.publisher,
    label: source.provenance.label,
    retrievedAt: new Date().toISOString(),
  };
}

function documentFor(source, buffer, filename) {
  if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("Downloaded candidate is not a PDF.");
  const digest = sha256(buffer);
  const defaults = {
    ...source,
    year: inferYear(source.url, source.year),
    county: inferCounty(source.url, source.county),
  };
  const metadata = inferDocumentMetadata(`${source.title ?? ""} ${filename}`, defaults);
  if (!metadata.olympiadSubject || !metadata.stage || !metadata.year) throw new Error(`Cannot infer required subject/stage/year from ${filename}.`);
  const title = source.title ?? path.basename(filename, path.extname(filename)).replaceAll(/[_-]+/g, " ").trim();
  const pairKey = inferPairKey(filename, metadata, source.pairKey);
  const identity = [metadata.olympiadSubject, metadata.stage, metadata.year, metadata.county, metadata.grade && `clasa-${metadata.grade}`, metadata.kind, metadata.language, digest.slice(0, 12)].filter(Boolean);
  const id = identity.map(slugify).join("-");
  const relative = path.posix.join("pdf", `${digest}.pdf`);
  return {
    document: {
      id,
      olympiadSubject: metadata.olympiadSubject,
      stage: metadata.stage,
      year: metadata.year,
      ...(metadata.county ? { county: metadata.county } : {}),
      ...(metadata.grade ? { grade: metadata.grade } : {}),
      kind: metadata.kind,
      language: metadata.language,
      pairKey,
      title,
      sourceUrl: source.url,
      assetKey: relative,
      sha256: digest,
      size: buffer.length,
      provenance: [provenanceFor(source)],
    },
    buffer,
    relative,
  };
}

async function processSource(source, cache) {
  const outcome = { sourceId: source.id, olympiadSubject: source.subject, stage: source.stage, status: "failed", documents: 0, sourceUrl: source.url };
  if (source.adapter === "unavailable") return { documents: [], outcome: { ...outcome, status: "unavailable", reason: source.reason } };
  const workRoot = await mkdtemp(path.join(os.tmpdir(), "iabacu-olympiad-"));
  try {
    const buffer = await download(source.url, source.parentSourceId ? new Map() : cache);
    const pdfFiles = buffer.subarray(0, 5).toString() === "%PDF-" ? [] : await extractArchive(buffer, source, workRoot);
    const candidates = pdfFiles.length
      ? await Promise.all(pdfFiles.map(async (file) => ({ buffer: await readFile(file), filename: path.relative(workRoot, file) })))
      : [{ buffer, filename: path.basename(new URL(source.url).pathname) }];
    const documents = candidates.map((candidate) => documentFor(source, candidate.buffer, candidate.filename));
    if (!documents.length) throw new Error("Archive contains no PDF documents.");
    return { documents, outcome: { ...outcome, status: "imported", documents: documents.length } };
  } catch (error) {
    return { documents: [], outcome: { ...outcome, reason: String(error instanceof Error ? error.message : error) } };
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
}

export async function runImport({ catalog, apply = false, merge = false, checkSources = false, subjectFilter, excludedSubject, sourceFilter, manifestPath = defaultManifestPath, assetRoot = defaultAssetRoot, assetBaseUrl = "/olimpiade" }) {
  const errors = validateCatalog(catalog);
  if (errors.length) throw new Error(`Invalid catalog:\n- ${errors.join("\n- ")}`);
  let selected = catalog.sources.filter((source) => !subjectFilter || source.subject === subjectFilter);
  selected = selected.filter((source) => !excludedSubject || source.subject !== excludedSubject);
  selected = selected.filter((source) => !sourceFilter || source.id === sourceFilter || source.id.startsWith(`${sourceFilter}-`));
  if (!selected.length) throw new Error("No catalog sources matched the filters.");
  if (!apply && !checkSources) {
    return {
      mode: "dry-run",
      documents: [],
      outcomes: selected.map((source) => ({ sourceId: source.id, olympiadSubject: source.subject, stage: source.stage, status: source.adapter === "unavailable" ? "unavailable" : "planned", reason: source.reason })),
    };
  }
  const cache = new Map();
  const expansionResults = await mapWithConcurrency(selected, 4, async (source) => {
    if (source.adapter === "unavailable") {
      return { expanded: [], outcome: (await processSource(source, cache)).outcome };
    }
    try {
      const discovered = await expandSource(source, cache);
      if (!discovered.length) throw new Error("Source adapter discovered no matching files.");
      return { expanded: discovered };
    } catch (error) {
      return { expanded: [], outcome: { sourceId: source.id, olympiadSubject: source.subject, stage: source.stage, sourceUrl: source.url, status: "failed", documents: 0, reason: String(error instanceof Error ? error.message : error) } };
    }
  });
  const expanded = expansionResults.flatMap((result) => result.expanded);
  const outcomes = expansionResults.flatMap((result) => result.outcome ? [result.outcome] : []);
  const writtenAssets = new Map();
  const results = await mapWithConcurrency(expanded, 8, async (source) => {
    const result = await processSource(source, cache);
    if (apply) {
      for (const candidate of result.documents) {
        if (!writtenAssets.has(candidate.document.sha256)) {
          const pending = (async () => {
            const destination = path.join(assetRoot, candidate.relative);
            await mkdir(path.dirname(destination), { recursive: true });
            await writeFile(destination, candidate.buffer);
          })();
          writtenAssets.set(candidate.document.sha256, pending);
        }
        await writtenAssets.get(candidate.document.sha256);
      }
    }
    return {
      ...result,
      documents: result.documents.map((candidate) => ({ document: candidate.document })),
    };
  });
  outcomes.push(...results.map((result) => result.outcome));
  const candidates = results.flatMap((result) => result.documents);
  let existingDocuments = [];
  let existingOutcomes = [];
  if (apply && merge) {
    try {
      const existing = JSON.parse(await readFile(manifestPath, "utf8"));
      const selectedIds = selected.map((source) => source.id);
      const belongsToSelection = (value = "") => selectedIds.some((id) => value === id || value.startsWith(`${id}-`));
      existingDocuments = (existing.documents ?? []).filter((document) =>
        document.olympiadSubject !== subjectFilter &&
        !(document.provenance ?? []).some((item) => belongsToSelection(item.sourceId) || belongsToSelection(item.parentSourceId)),
      );
      existingOutcomes = (existing.sources ?? []).filter((outcome) =>
        outcome.olympiadSubject !== subjectFilter && !belongsToSelection(outcome.sourceId),
      );
    } catch {}
  }
  const coverage = catalog.subjects.flatMap((subject) => Object.entries(subject.coverage).map(([stage, detail]) => ({ olympiadSubject: subject.id, stage, ...detail })));
  const manifest = buildManifest({
    documents: [...existingDocuments, ...candidates.map((candidate) => candidate.document)],
    outcomes: [...existingOutcomes, ...outcomes],
    coverage,
    catalogVersion: catalog.version,
    assetBaseUrl,
  });
  if (apply) {
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return { mode: apply ? "apply" : "check-sources", documents: manifest.documents, outcomes, manifest };
}

async function main() {
  const catalogPath = path.resolve(option("--catalog", defaultCatalogPath));
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const result = await runImport({
    catalog,
    apply: process.argv.includes("--apply"),
    merge: process.argv.includes("--merge"),
    checkSources: process.argv.includes("--check-sources"),
    subjectFilter: option("--subject"),
    excludedSubject: option("--exclude-subject"),
    sourceFilter: option("--source"),
    manifestPath: path.resolve(option("--manifest", defaultManifestPath)),
    assetRoot: path.resolve(option("--assets", defaultAssetRoot)),
    assetBaseUrl: option("--asset-base-url", "/olympiad"),
  });
  for (const outcome of result.outcomes) console.log(JSON.stringify(outcome));
  console.log(`${result.mode}: ${result.documents.length} documents; ${result.outcomes.filter((item) => item.status === "failed").length} failed sources; ${result.outcomes.filter((item) => item.status === "unavailable").length} unavailable sources.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
