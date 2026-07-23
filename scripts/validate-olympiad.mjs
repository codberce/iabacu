import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "src", "data", "olympiad.json");
const indexPath = path.join(root, "src", "data", "olympiad-index.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const index = JSON.parse(await readFile(indexPath, "utf8"));
const publicRoot = path.join(root, "public");
const olympiadPublicRoot = path.join(publicRoot, "olimpiada-matematica");
const required = [
  "id",
  "stage",
  "year",
  "kind",
  "title",
  "pdfPath",
  "sourceUrl",
  "sha256",
  "size",
];
const stages = new Set(["locala", "judeteana", "nationala"]);
const kinds = new Set(["subject", "solution", "combined"]);
let hasLocalArchive = true;
try {
  await stat(olympiadPublicRoot);
} catch {
  hasLocalArchive = false;
  if (!manifest.assetBaseUrl) {
    fail("The olympiad asset catalog is missing its source base URL.");
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(message) {
  throw new Error(message);
}

function localPdfPath(pdfPath) {
  if (typeof pdfPath !== "string" || !pdfPath.startsWith("/")) {
    fail(`Invalid PDF path ${JSON.stringify(pdfPath)}`);
  }
  const absolutePath = path.resolve(publicRoot, `.${pdfPath}`);
  if (!absolutePath.startsWith(`${publicRoot}${path.sep}`)) {
    fail(`PDF path escapes public directory: ${pdfPath}`);
  }
  return absolutePath;
}

async function validatePdf(document) {
  if (!hasLocalArchive) return;
  const absolutePath = localPdfPath(document.pdfPath);
  let bytes;
  let metadata;
  let resolvedPath;
  try {
    resolvedPath = await realpath(absolutePath);
  } catch (error) {
    fail(`${document.id} missing PDF at ${document.pdfPath}: ${error.message}`);
  }
  if (!resolvedPath.startsWith(`${publicRoot}${path.sep}`)) {
    fail(`${document.id} PDF path escapes public directory: ${document.pdfPath}`);
  }
  try {
    [bytes, metadata] = await Promise.all([readFile(resolvedPath), stat(resolvedPath)]);
  } catch (error) {
    fail(`${document.id} missing PDF at ${document.pdfPath}: ${error.message}`);
  }

  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    fail(`${document.id} has an invalid PDF signature at ${document.pdfPath}`);
  }
  if (metadata.size !== document.size) {
    fail(`${document.id} size mismatch at ${document.pdfPath}`);
  }
  if (sha256(bytes) !== document.sha256) {
    fail(`${document.id} checksum mismatch at ${document.pdfPath}`);
  }
}

if (!Array.isArray(manifest.documents)) {
  fail("src/data/olympiad.json must contain a documents array");
}
if (index.version !== 1 || !Array.isArray(index.documents)) {
  fail("src/data/olympiad-index.json must be a version 1 generated index");
}

const ids = new Set();
const ambiguousLocalDocuments = [];

for (const document of manifest.documents) {
  for (const key of required) {
    if (document[key] === undefined || document[key] === null || document[key] === "") {
      fail(`${document.id ?? "unknown"} missing ${key}`);
    }
  }
  if (typeof document.id !== "string") fail("Olympiad document id must be a string");
  if (ids.has(document.id)) fail(`Duplicate olympiad document id ${document.id}`);
  ids.add(document.id);
  if (!stages.has(document.stage)) fail(`${document.id} has invalid stage ${document.stage}`);
  if (!kinds.has(document.kind)) fail(`${document.id} has invalid kind ${document.kind}`);
  if (!Number.isInteger(document.year)) fail(`${document.id} has invalid year`);
  if (document.grade !== undefined && (!Number.isInteger(document.grade) || document.grade < 5 || document.grade > 12)) {
    fail(`${document.id} has invalid grade`);
  }
  let sourceUrl;
  try {
    sourceUrl = new URL(document.sourceUrl);
  } catch {
    fail(`${document.id} has invalid source URL`);
  }
  if (typeof document.sourceUrl !== "string" || !["http:", "https:"].includes(sourceUrl.protocol) || !sourceUrl.hostname) {
    fail(`${document.id} has invalid source URL`);
  }
  if (!/^[a-f0-9]{64}$/.test(document.sha256)) fail(`${document.id} has invalid SHA-256`);
  if (!Number.isSafeInteger(document.size) || document.size <= 0) fail(`${document.id} has invalid size`);

  await validatePdf(document);

  if (document.stage === "locala" && document.grade === undefined) {
    ambiguousLocalDocuments.push(document);
  }
}

const expectedIndexDocuments = manifest.documents.map((document) => [
  document.id,
  document.stage,
  document.year,
  document.county ?? null,
  document.grade ?? null,
  document.kind,
  document.title,
  document.sourceUrl,
  document.sha256,
  document.size,
  ["blob", "r2"].includes(manifest.assetStorage) ? null : document.pdfPath,
]);
if (
  index.generatedAt !== manifest.generatedAt ||
  index.assetStorage !== (manifest.assetStorage ?? "local") ||
  index.assetBaseUrl !== (manifest.assetBaseUrl ?? null) ||
  JSON.stringify(index.documents) !== JSON.stringify(expectedIndexDocuments)
) {
  fail("Olympiad application index is stale; run pnpm build:olympiad-index");
}

console.log(
  `Validated ${manifest.documents.length} olympiad documents (${hasLocalArchive ? "local files" : "content-addressed storage"}).`,
);
if (ambiguousLocalDocuments.length > 0) {
  const examples = ambiguousLocalDocuments
    .slice(0, 10)
    .map((document) => document.pdfPath)
    .join(", ");
  console.warn(
    `Reported ${ambiguousLocalDocuments.length} local documents with ambiguous ungraded filenames (not validation errors): ${examples}${ambiguousLocalDocuments.length > 10 ? ", …" : ""}`,
  );
}
