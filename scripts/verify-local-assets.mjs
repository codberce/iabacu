import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(root, "src", "data");
const publicDirectory = path.join(root, "public");
const missing = [];
const checked = new Set();
const jsonFlagIndex = process.argv.indexOf("--json");
const jsonPath = jsonFlagIndex >= 0 ? process.argv[jsonFlagIndex + 1] : undefined;
let pdfCount = 0;
let textCount = 0;

function requireFile(relativePath, kind) {
  if (checked.has(relativePath)) return;
  checked.add(relativePath);
  const absolutePath = path.join(publicDirectory, relativePath);
  if (
    !fs.existsSync(absolutePath) ||
    (kind === "pdf" && fs.statSync(absolutePath).size === 0)
  ) {
    missing.push(relativePath);
  } else if (kind === "pdf") {
    pdfCount += 1;
  } else {
    textCount += 1;
  }
}

const examFiles = [
  "exams.json",
  "exams-romana.json",
  "exams-fizica.json",
  "exams-informatica.json",
  "exams-evaluare-nationala-matematica.json",
  "exams-evaluare-nationala-romana.json",
  ...fs.readdirSync(dataDirectory).filter((name) =>
    name.startsWith("archive-") && name.endsWith(".json")),
];

for (const fileName of examFiles) {
  const exams = JSON.parse(fs.readFileSync(path.join(dataDirectory, fileName)));
  for (const exam of exams) {
    for (const sourcePath of [exam.examPdfPath, exam.baremPdfPath]) {
      const archiveMatch = sourcePath.match(
        /^\/api\/archive-pdf\/(\d+)\/(subject|barem)(?:\.pdf)?$/,
      );
      const relativePath = archiveMatch
        ? `archive/${archiveMatch[1]}-${archiveMatch[2]}.pdf`
        : sourcePath.replace(/^\//, "");
      requireFile(relativePath, "pdf");
    }
  }
}

const mathematicsIndex = JSON.parse(
  fs.readFileSync(path.join(dataDirectory, "olympiad-index.json")),
);
const subjectIndex = JSON.parse(
  fs.readFileSync(path.join(dataDirectory, "olympiad-subject-index.json")),
);
const hashes = new Set([
  ...mathematicsIndex.documents.map((document) => document[8]),
  ...subjectIndex.documents.map((document) => document.sha256),
]);

for (const hash of hashes) {
  requireFile(`olympiad/pdf/${hash}.pdf`, "pdf");
  requireFile(`olympiad/text/${hash}.txt`, "text");
}

const report = {
  complete: missing.length === 0,
  pdfCount,
  textCount,
  missing,
};

if (jsonPath) {
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (missing.length > 0) {
  console.error(`Lipsesc ${missing.length} fișiere locale.`);
  for (const file of missing.slice(0, 20)) console.error(`- public/${file}`);
  if (missing.length > 20) console.error(`... și încă ${missing.length - 20}`);
  process.exitCode = 1;
} else {
  console.log(`Arhiva locală este completă: ${pdfCount} PDF-uri și ${textCount} texte.`);
}
