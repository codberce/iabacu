import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptRoot, "..");
const defaultOutputPath = path.join(projectRoot, "src", "data", "olympiad-platform-index.json");

export const STAGES = ["locala", "judeteana", "nationala"];
export const PROVIDERS = ["kilonova", "mlcompete", "cyberedu"];
export const SUBJECTS = ["informatica", "inteligenta-artificiala", "securitate-cibernetica"];
export const REQUIRED_FAMILIES = [
  { provider: "kilonova", stage: "locala", label: "Kilonova local" },
  { provider: "kilonova", stage: "judeteana", label: "Kilonova county" },
  { provider: "kilonova", stage: "nationala", label: "Kilonova national" },
  { provider: "mlcompete", stage: null, label: "MLCompete" },
  { provider: "cyberedu", stage: null, label: "CyberEDU" },
];
const MIN_YEAR = 2000;
const MAX_YEAR = 2099;
const MIN_GRADE = 5;
const MAX_GRADE = 12;
const MANIFEST_VERSION = 1;

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#34;", "\"")
    .replaceAll("&quot;", "\"")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "iabacu-platform-import/1.0 (+https://iabacu.ro)" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

async function mapConcurrent(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  }));
  return output;
}

const roman = { V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

function gradesFrom(value, fallback = []) {
  const range = value.match(/\b(V|VI|VII|VIII|IX|X|XI|XII)\s*[-–]\s*(V|VI|VII|VIII|IX|X|XI|XII)\b/i);
  if (range) {
    const start = roman[range[1].toUpperCase()];
    const end = roman[range[2].toUpperCase()];
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  const matches = [...value.matchAll(/\b(XII|VIII|VII|VI|XI|IX|V|X)\b/gi)];
  return matches.length ? [roman[matches.at(-1)[1].toUpperCase()]] : fallback;
}

async function importKilonovaRoot(rootId, stage) {
  const visited = new Set();
  const exams = [];
  async function visit(listId, context = {}) {
    if (visited.has(listId)) return;
    visited.add(listId);
    const html = await fetchText(`https://kilonova.ro/problem_lists/${listId}`);
    const ownTitle = decodeHtml(html.match(/<span>([^<]*?)<a href="\/problem_lists\/[0-9]+">\(#[0-9]+\)<\/a><\/span>/i)?.[1] ?? "");
    const year = Number(ownTitle.match(/\b(20\d{2})\b/)?.[1] ?? context.year) || undefined;
    const grades = gradesFrom(ownTitle, context.grades);
    const childMap = new Map();
    for (const match of html.matchAll(/<span>([\s\S]*?)<a href="\/problem_lists\/(\d+)">\(#[0-9]+\)<\/a><\/span>/gi)) {
      const childId = match[2];
      if (childId === String(listId)) continue;
      childMap.set(childId, decodeHtml(match[1]));
    }
    const problems = [...html.matchAll(/<a href="\/problems\/(\d+)\?list_id=(\d+)"[^>]*><span>([\s\S]*?)\(#[0-9]+\)<\/span>/gi)];
    for (const match of problems) {
      if (!year || !grades.length) continue;
      const problemId = match[1];
      const problemName = decodeHtml(match[3]);
      for (const grade of grades) {
        exams.push({
          id: `olimpiada-informatica-${stage}-${year}-${grade}-${problemId}`,
          olympiadSubject: "informatica",
          stage,
          year,
          grade,
          title: `Olimpiada de Informatică ${year} · Clasa a ${grade}-a · ${problemName}`,
          platformUrl: `https://kilonova.ro/problems/${problemId}?list_id=${match[2]}`,
          provider: "kilonova",
          order: Number(problemId),
        });
      }
    }
    await mapConcurrent([...childMap], 8, ([childId, childTitle]) => visit(childId, {
      year: Number(childTitle.match(/\b(20\d{2})\b/)?.[1] ?? year) || undefined,
      grades: gradesFrom(childTitle, grades),
    }));
  }
  await visit(rootId);
  return exams;
}

async function importMlCompete() {
  const html = `${await fetchText("https://platform.olimpiada-ai.ro/ro/competitions")}\n${await fetchText("https://platform.olimpiada-ai.ro/ro/competitions?page=1&size=9")}`;
  const exams = [];
  const pattern = /href="\/ro\/competitions\/(\d+)"[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = decodeHtml(match[2]);
    if (!/Olimpiada Națională de Inteligență Artificială/i.test(title)) continue;
    if (/Simulare/i.test(title)) continue;
    const year = Number(title.match(/\b(20\d{2})\b/)?.[1]);
    const stage = /Etapa Local/i.test(title) ? "locala" : /Etapa Jude/i.test(title) ? "judeteana" : /Etapa Na/i.test(title) ? "nationala" : undefined;
    if (!year || !stage) continue;
    const numericRange = title.match(/Claselor?\s+(9|10|11|12)\s*[-–]\s*(9|10|11|12)/i);
    const grades = numericRange
      ? Array.from({ length: Number(numericRange[2]) - Number(numericRange[1]) + 1 }, (_, index) => Number(numericRange[1]) + index)
      : [9, 10, 11, 12];
    for (const grade of grades) {
      exams.push({
        id: `olimpiada-inteligenta-artificiala-${stage}-${year}-${grade}-${match[1]}`,
        olympiadSubject: "inteligenta-artificiala",
        stage,
        year,
        grade,
        title: `Olimpiada de Inteligență artificială ${year} · Clasa a ${grade}-a · Etapa ${stage}`,
        platformUrl: `https://platform.olimpiada-ai.ro/ro/competitions/${match[1]}`,
        provider: "mlcompete",
        order: Number(match[1]),
      });
    }
  }
  return exams;
}

function importCyberEdu() {
  const exams = [];
  const competitions = [{
    year: 2026,
    stage: "judeteana",
    url: "https://app.cyber-edu.co/competition/oscj26?tenant=cyberedu",
  }];
  for (const competition of competitions) {
    for (const grade of [9, 10, 11, 12]) {
      exams.push({
        id: `olimpiada-securitate-cibernetica-${competition.stage}-${competition.year}-${grade}`,
        olympiadSubject: "securitate-cibernetica",
        stage: competition.stage,
        year: competition.year,
        grade,
        title: `Olimpiada de Securitate cibernetică ${competition.year} · Clasa a ${grade}-a · Etapa ${competition.stage}`,
        platformUrl: competition.url,
        provider: "cyberedu",
        order: competition.year * 10,
      });
    }
  }
  return exams;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sortPlatformExams(exams) {
  return [...exams].toSorted((a, b) =>
    b.year - a.year
    || a.grade - b.grade
    || a.order - b.order
    || a.provider.localeCompare(b.provider)
    || a.id.localeCompare(b.id),
  );
}

export function dedupePlatformExams(exams) {
  const seen = new Set();
  const unique = [];
  for (const exam of exams) {
    if (seen.has(exam.id)) continue;
    seen.add(exam.id);
    unique.push(exam);
  }
  return unique;
}

export function validatePlatformExams(exams) {
  if (!Array.isArray(exams)) {
    return ["Exams payload must be an array."];
  }
  const errors = [];
  const seenIds = new Set();
  const requiredStringFields = ["id", "olympiadSubject", "stage", "title", "platformUrl", "provider"];
  for (let index = 0; index < exams.length; index += 1) {
    const exam = exams[index];
    const prefix = `exams[${index}]`;
    if (!exam || typeof exam !== "object" || Array.isArray(exam)) {
      errors.push(`${prefix}: must be an object.`);
      continue;
    }
    for (const field of requiredStringFields) {
      if (typeof exam[field] !== "string" || exam[field].trim() === "") {
        errors.push(`${prefix}.${field}: must be a non-empty string.`);
      }
    }
    if (!SUBJECTS.includes(exam.olympiadSubject)) {
      errors.push(`${prefix}.olympiadSubject: must be one of ${SUBJECTS.join(", ")}.`);
    }
    if (!STAGES.includes(exam.stage)) {
      errors.push(`${prefix}.stage: must be one of ${STAGES.join(", ")}.`);
    }
    if (!PROVIDERS.includes(exam.provider)) {
      errors.push(`${prefix}.provider: must be one of ${PROVIDERS.join(", ")}.`);
    }
    if (!Number.isInteger(exam.year) || exam.year < MIN_YEAR || exam.year > MAX_YEAR) {
      errors.push(`${prefix}.year: must be an integer between ${MIN_YEAR} and ${MAX_YEAR}.`);
    }
    if (!Number.isInteger(exam.grade) || exam.grade < MIN_GRADE || exam.grade > MAX_GRADE) {
      errors.push(`${prefix}.grade: must be an integer between ${MIN_GRADE} and ${MAX_GRADE}.`);
    }
    if (!isHttpsUrl(exam.platformUrl)) {
      errors.push(`${prefix}.platformUrl: must be a valid https:// URL.`);
    }
    if (!isNonNegativeInteger(exam.order)) {
      errors.push(`${prefix}.order: must be a non-negative integer.`);
    }
    if (typeof exam.id === "string") {
      if (seenIds.has(exam.id)) {
        errors.push(`${prefix}.id: duplicate id ${JSON.stringify(exam.id)}.`);
      } else {
        seenIds.add(exam.id);
      }
    }
  }
  for (const family of REQUIRED_FAMILIES) {
    const matches = exams.filter((exam) =>
      exam.provider === family.provider
      && (family.stage === null || exam.stage === family.stage),
    );
    if (matches.length === 0) {
      errors.push(`${family.label}: no imported records; refusing to write a partial index.`);
    }
  }
  return errors;
}

export function buildPlatformManifest(exams, generatedAt = new Date().toISOString()) {
  const sorted = sortPlatformExams(exams);
  const errors = validatePlatformExams(sorted);
  if (errors.length) {
    throw new Error(`Invalid platform exams:\n- ${errors.join("\n- ")}`);
  }
  return {
    version: MANIFEST_VERSION,
    generatedAt,
    exams: sorted,
  };
}

export async function collectPlatformExams({ fetchImpl = fetch } = {}) {
  const previousFetch = globalThis.fetch;
  if (fetchImpl !== fetch) globalThis.fetch = fetchImpl;
  try {
    const [local, county, national, mlcompete, cyberedu] = await Promise.all([
      importKilonovaRoot(1366, "locala"),
      importKilonovaRoot(452, "judeteana"),
      importKilonovaRoot(507, "nationala"),
      importMlCompete(),
      Promise.resolve(importCyberEdu()),
    ]);
    const all = dedupePlatformExams([...local, ...county, ...national, ...mlcompete, ...cyberedu]);
    return { local, county, national, mlcompete, cyberedu, all };
  } finally {
    if (fetchImpl !== fetch) globalThis.fetch = previousFetch;
  }
}

async function writeAtomically(outputPath, payload) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(tempPath, payload);
    await rename(tempPath, outputPath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function runImport({ apply = true, outputPath = defaultOutputPath, fetchImpl = fetch, now = () => new Date().toISOString() } = {}) {
  const collected = await collectPlatformExams({ fetchImpl });
  const manifest = buildPlatformManifest(collected.all, now());
  if (!apply) {
    return {
      mode: "dry-run",
      manifest,
      counts: {
        local: collected.local.length,
        county: collected.county.length,
        national: collected.national.length,
        mlcompete: collected.mlcompete.length,
        cyberedu: collected.cyberedu.length,
        total: collected.all.length,
      },
    };
  }
  const payload = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeAtomically(outputPath, payload);
  return {
    mode: "apply",
    outputPath,
    manifest,
    counts: {
      local: collected.local.length,
      county: collected.county.length,
      national: collected.national.length,
      mlcompete: collected.mlcompete.length,
      cyberedu: collected.cyberedu.length,
      total: collected.all.length,
    },
  };
}

function option(name, fallback) {
  const argument = process.argv.find((item) => item.startsWith(`${name}=`));
  return argument ? argument.slice(name.length + 1) : fallback;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const outputPath = path.resolve(option("--output", defaultOutputPath));
  const result = await runImport({ apply: !dryRun, outputPath });
  console.log(
    `${result.mode === "apply" ? "Imported" : "Planned"} ${result.counts.total} platform tasks `
    + `(${result.counts.local} local, ${result.counts.county} county, ${result.counts.national} national, `
    + `${result.counts.mlcompete} AI, ${result.counts.cyberedu} cyber).`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
