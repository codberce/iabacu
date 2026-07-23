import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(root, "src", "data");
const manifestPath = path.join(dataRoot, "bac-manifest.json");
const indexPath = path.join(dataRoot, "bac-index.json");
const aliasesPath = path.join(dataRoot, "bac-aliases.json");
const checkOnly = process.argv.includes("--check");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const aliases = JSON.parse(await readFile(aliasesPath, "utf8"));

// Tuple layout is intentionally compact. The full manifest remains the
// provenance source for imports, audits, and future immutable asset metadata.
// The trailing null slot reserves space for a textObjectKey once assets are
// migrated to immutable storage; today every Bac exam is still legacy.
const indexExams = manifest.exams.map((exam) => {
  const subject = exam.documents.subject.copies[0];
  const rubric = exam.documents.rubric.copies[0];
  return [
    exam.id,
    exam.subject,
    exam.year,
    exam.order,
    exam.profile,
    exam.language,
    exam.sessionType,
    exam.sessionLabel,
    exam.dateLabel,
    exam.title,
    exam.contextPath,
    exam.durationMinutes,
    exam.format,
    [
      subject.id,
      subject.assetSha256,
      subject.sourceKind,
      subject.sourceUrl,
      subject.pdfPath,
      subject.verificationStatus,
      null,
    ],
    [
      rubric.id,
      rubric.assetSha256,
      rubric.sourceKind,
      rubric.sourceUrl,
      rubric.pdfPath,
      rubric.verificationStatus,
      null,
    ],
  ];
});

const index = {
  version: 2,
  generatedAt: manifest.generatedAt,
  assetStorage: manifest.assetStorage,
  assetBaseUrl: manifest.assetBaseUrl,
  aliases,
  exams: indexExams,
};

const indexOutput = `${JSON.stringify(index)}\n`;

if (checkOnly) {
  const existingIndex = await readFile(indexPath, "utf8");
  if (existingIndex !== indexOutput) {
    throw new Error("Bac index is stale; run pnpm build:bac-index");
  }
  console.log(
    `Validated deterministic ${path.relative(root, indexPath)} with ${indexExams.length} exams and ${aliases.length} aliases.`,
  );
} else {
  await writeFile(indexPath, indexOutput);
  console.log(
    `Built ${path.relative(root, indexPath)} with ${indexExams.length} exams and ${aliases.length} aliases.`,
  );
}
