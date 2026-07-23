import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "src", "data", "olympiad.json");
const indexPath = path.join(root, "src", "data", "olympiad-index.json");
const checkOnly = process.argv.includes("--check");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const includeLegacyPaths = !["blob", "r2"].includes(manifest.assetStorage);

// Tuple layout is intentionally compact because this index is bundled into the
// application. The full provenance-rich manifest remains the import source.
const documents = manifest.documents.map((document) => [
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
  includeLegacyPaths ? document.pdfPath : null,
]);

const indexOutput = `${JSON.stringify({ version: 1, generatedAt: manifest.generatedAt, assetStorage: manifest.assetStorage ?? "local", assetBaseUrl: manifest.assetBaseUrl ?? null, documents })}\n`;

if (checkOnly) {
  const existingIndex = await readFile(indexPath, "utf8");
  if (existingIndex !== indexOutput) {
    throw new Error("Olympiad index is stale; run pnpm build:olympiad-index");
  }
  console.log(`Validated deterministic ${path.relative(root, indexPath)} with ${documents.length} documents.`);
} else {
  await writeFile(indexPath, indexOutput);
  console.log(`Built ${path.relative(root, indexPath)} with ${documents.length} documents.`);
}
