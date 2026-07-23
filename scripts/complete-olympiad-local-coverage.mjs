import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "src", "data", "olympiad.json");
const counties = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud",
  "Botoșani", "Brașov", "Brăila", "București", "Buzău", "Caraș-Severin",
  "Călărași", "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj",
  "Galați", "Giurgiu", "Gorj", "Harghita", "Hunedoara", "Ialomița",
  "Iași", "Ilfov", "Maramureș", "Mehedinți", "Mureș", "Neamț", "Olt",
  "Prahova", "Satu Mare", "Sălaj", "Sibiu", "Suceava", "Teleorman",
  "Timiș", "Tulcea", "Vaslui", "Vâlcea", "Vrancea",
];
const grades = [9, 10, 11, 12];

function normalize(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function slugify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function gradesFor(document) {
  if (document.grade) return [document.grade];
  const title = normalize(document.title);
  if (/(?:9|ix)\s*[-–]\s*(?:12|xii)|liceu\s*(?:si|\+|-)\s*gimnaziu|toate clasele/.test(title)) {
    return grades;
  }
  const numeric = [...title.matchAll(/(?:^|[^0-9])(0?[5-9]|1[0-2])(?=(?:sb|sub|bar|barem)|[^0-9]|$)/g)]
    .map((match) => Number(match[1]));
  const romanMap = { v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
  const roman = [...title.matchAll(/(?:^|[^a-z0-9])(xii|viii|vii|vi|xi|ix|v|x)(?=[^a-z0-9]|$)/g)]
    .map((match) => romanMap[match[1]]);
  return [...new Set([...numeric, ...roman])];
}

function supportsKind(document, kind) {
  return document.kind === kind || document.kind === "combined";
}

function sourceScore(document, county, kind) {
  return (document.county === county ? 1000 : 0) +
    (document.grade != null ? 100 : 0) +
    (document.kind === kind ? 10 : 0) -
    (document.county == null ? 1 : 0);
}

function chooseSource(documents, year, grade, county, kind) {
  return documents
    .filter((document) =>
      document.stage === "locala" &&
      document.year === year &&
      gradesFor(document).includes(grade) &&
      supportsKind(document, kind),
    )
    .toSorted((a, b) => sourceScore(b, county, kind) - sourceScore(a, county, kind) || a.id.localeCompare(b.id, "ro"))
    .at(0);
}

function countyDocuments(documents, year, county, grade) {
  return documents.filter((document) =>
    document.stage === "locala" &&
    document.year === year &&
    document.county === county &&
    gradesFor(document).includes(grade),
  );
}

function generatedDocument(source, { year, county, grade, kind }) {
  const sharedFrom = source.county ?? "material-comun";
  const id = [
    "locala", year, slugify(county), `clasa-${grade}`, kind,
    "material-comun", slugify(sharedFrom), source.sha256.slice(0, 8),
  ].join("-");
  return {
    ...source,
    id,
    year,
    county,
    grade,
    kind: source.kind === "combined" ? "combined" : kind,
    title: `Olimpiada de Matematică ${year} · Etapa locală · ${county} · clasa a ${grade}-a · material comun`,
    coverage: "shared",
    sharedFrom: source.county,
  };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const originalDocuments = manifest.documents;
const years = [...new Set(originalDocuments.filter((document) => document.stage === "locala").map((document) => document.year))]
  .toSorted((a, b) => a - b);
const additions = [];
const existingKeys = new Set(originalDocuments.map((document) => [document.stage, document.year, document.county ?? "", document.grade ?? "", document.kind].join(":")));

for (const year of years) {
  for (const county of counties) {
    for (const grade of grades) {
      const existing = countyDocuments(originalDocuments, year, county, grade);
      for (const kind of ["subject", "solution"]) {
        if (existing.some((document) => supportsKind(document, kind))) continue;
        const source = chooseSource(originalDocuments, year, grade, county, kind);
        if (!source) throw new Error(`No ${kind} source for ${year}, ${county}, grade ${grade}`);
        const document = generatedDocument(source, { year, county, grade, kind });
        const key = [document.stage, year, county, grade, document.kind].join(":");
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          additions.push(document);
        }
      }
    }
  }
}

const documents = [...originalDocuments, ...additions].toSorted((a, b) =>
  b.year - a.year || (a.county ?? "").localeCompare(b.county ?? "", "ro") || a.id.localeCompare(b.id),
);
await writeFile(manifestPath, `${JSON.stringify({ ...manifest, generatedAt: new Date().toISOString(), documents }, null, 2)}\n`);
console.log(`Added ${additions.length} shared local documents; manifest now contains ${documents.length} documents.`);
