import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifests = [
  ["src/data/exams.json", "matematica", 40],
  ["src/data/exams-romana.json", "romana", 1],
  ["src/data/exams-fizica.json", "fizica", 1],
  ["src/data/exams-informatica.json", "informatica", 1],
];
const required = [
  "id",
  "year",
  "profile",
  "language",
  "sessionType",
  "sessionLabel",
  "examPdfPath",
  "baremPdfPath",
  "contextPath",
  "sourceUrl",
  "baremSourceUrl",
  "sourceKind",
  "sha256",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function validatePdf(repoPath, expectedSha, examId) {
  const absolutePath = path.join(root, "public", repoPath.replace(/^\//, ""));
  const bytes = await readFile(absolutePath);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error(`${examId} has an invalid PDF at ${repoPath}`);
  }
  if (sha256(bytes) !== expectedSha) {
    throw new Error(`${examId} checksum mismatch at ${repoPath}`);
  }
}

let hasLocalAssets = true;
try {
  await stat(path.join(root, "public", "exams"));
} catch {
  hasLocalAssets = false;
  console.log("PDF-urile offline nu sunt instalate; se verifică doar metadatele.");
}

const ids = new Set();
let total = 0;

for (const [manifestPath, expectedSubject, minimum] of manifests) {
  const exams = JSON.parse(await readFile(path.join(root, manifestPath), "utf8"));
  if (!Array.isArray(exams) || exams.length < minimum) {
    throw new Error(`${manifestPath}: expected at least ${minimum}, found ${exams.length}`);
  }

  for (const exam of exams) {
    for (const key of required) {
      if (!(key in exam)) throw new Error(`${exam.id ?? "unknown"} missing ${key}`);
    }
    if (ids.has(exam.id)) throw new Error(`Duplicate exam id ${exam.id}`);
    ids.add(exam.id);
    if ((exam.subject ?? "matematica") !== expectedSubject) {
      throw new Error(`${exam.id} wrong subject`);
    }
    if (exam.language !== "LRO") throw new Error(`${exam.id} wrong language`);
    if (!/^https?:\/\//.test(exam.sourceUrl)) throw new Error(`${exam.id} bad source`);
    if (!exam.sha256.exam || !exam.sha256.barem) {
      throw new Error(`${exam.id} missing checksums`);
    }

    if (hasLocalAssets) {
      await Promise.all([
        validatePdf(exam.examPdfPath, exam.sha256.exam, exam.id),
        validatePdf(exam.baremPdfPath, exam.sha256.barem, exam.id),
      ]);
    }
    const context = JSON.parse(
      await readFile(path.join(root, exam.contextPath), "utf8"),
    );
    if (context.examId !== exam.id) throw new Error(`${exam.id} wrong context`);
    await stat(path.join(root, exam.contextPath));
  }

  total += exams.length;
  console.log(`Validated ${exams.length} ${expectedSubject} exams.`);
}

console.log(`Validated ${total} exams across ${manifests.length} subjects.`);
