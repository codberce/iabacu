import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(root, "src", "data");
const zeroSha256 = "0".repeat(64);
const reportArgument = process.argv.find((argument) =>
  argument.startsWith("--json="),
);
const reportPath = reportArgument
  ? path.resolve(root, reportArgument.slice("--json=".length))
  : undefined;

async function readJson(file) {
  return JSON.parse(await readFile(path.join(dataRoot, file), "utf8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("ro");
}

function normalize(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function normalizedProfile(value) {
  return normalize(value)
    .replace("mmateinfo", "m1")
    .replace("mstiintenaturii", "m2")
    .replace("mtehnologic", "m3")
    .replace("mpedagogic", "m4");
}

function bacCandidateKey(exam) {
  return [
    exam.subject ?? "matematica",
    exam.year,
    exam.sessionType,
    normalizedProfile(exam.profile),
  ].join("|");
}

function inferredOlympiadGrades(document) {
  if (document.grade) return [document.grade];
  const title = normalizeText(document.title);
  const grades = [5, 6, 7, 8, 9, 10, 11, 12];
  if (
    /(?:5|v)\s*[-–]\s*(?:12|xii)|(?:9|ix)\s*[-–]\s*(?:12|xii)|(?:5|v)\s*(?:la|pana la)\s*(?:12|xii)|gimnaziu\s*(?:si|\+|-)\s*liceu|toate clasele/.test(
      title,
    )
  ) {
    return grades;
  }
  if (title.includes("gimnaziu") && !title.includes("liceu")) {
    return grades.filter((grade) => grade <= 8);
  }
  if (title.includes("liceu") && !title.includes("gimnaziu")) {
    return grades.filter((grade) => grade >= 9);
  }
  const numeric = [
    ...title.matchAll(/(?:^|[^0-9])(0?[5-9]|1[0-2])(?=(?:sb|sub|bar|barem)|[^0-9]|$)/g),
  ].map((match) => Number(match[1]));
  const romanMap = {
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
    xi: 11,
    xii: 12,
  };
  const roman = [
    ...title.matchAll(/(?:^|[^a-z0-9])(xii|viii|vii|vi|xi|ix|v|x)(?=[^a-z0-9]|$)/g),
  ].map((match) => romanMap[match[1]]);
  return [...new Set([...numeric, ...roman])];
}

function currentOlympiadGrades(document) {
  const inferred = inferredOlympiadGrades(document);
  return inferred.length > 0 ? inferred : [5, 6, 7, 8, 9, 10, 11, 12];
}

function effectiveOlympiadKind(document) {
  if (document.kind !== "combined") return document.kind;
  const title = normalizeText(document.title);
  const subject = /(?:^|[^a-z])(?:sb|sub|subiect|subiecte|enunt|enunturi)(?=[^a-z]|$)/.test(
    title,
  );
  const solution = /(?:^|[^a-z])(?:bar|barem|bareme|sol|solutie|solutii|rezolvare|rezolvari|raspuns|raspunsuri)(?=[^a-z]|$)/.test(
    title,
  );
  if (subject && !solution) return "subject";
  if (solution && !subject) return "solution";
  return "combined";
}

const dataFiles = await readdir(dataRoot);
const externalFiles = dataFiles
  .filter((file) => /^archive-.*\.json$/.test(file))
  .toSorted();
const externalBac = (await Promise.all(externalFiles.map(readJson))).flat();
const localBac = (
  await Promise.all(
    [
      "exams.json",
      "exams-romana.json",
      "exams-fizica.json",
      "exams-informatica.json",
    ].map(readJson),
  )
)
  .flat()
  .map((exam) => ({ ...exam, subject: exam.subject ?? "matematica" }));

const externalByCandidate = Object.groupBy(externalBac, bacCandidateKey);
const localDuplicateCandidates = localBac.flatMap((exam) =>
  (externalByCandidate[bacCandidateKey(exam)] ?? []).map((candidate) => ({
    localId: exam.id,
    externalId: candidate.id,
    key: bacCandidateKey(exam),
  })),
);

const olympiad = await readJson("olympiad.json");
const olympiadDocuments = olympiad.documents;
const groups = new Map();
for (const document of olympiadDocuments) {
  for (const grade of currentOlympiadGrades(document)) {
    const key = [
      document.stage,
      document.year,
      document.county ?? "",
      grade,
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), document]);
  }
}

const expandedGroups = [...groups.entries()].map(([key, documents]) => ({
  key,
  documents,
  kinds: documents.map(effectiveOlympiadKind),
}));
const incompleteGroups = expandedGroups.filter(({ kinds }) => {
  const available = new Set(kinds);
  return !(
    available.has("combined") ||
    (available.has("subject") && available.has("solution"))
  );
});
const reusedDocumentGroups = expandedGroups.filter(({ documents, kinds }) => {
  const subject = documents.find((_, index) =>
    ["subject", "combined"].includes(kinds[index]),
  );
  const solution = documents.find((_, index) =>
    ["solution", "combined"].includes(kinds[index]),
  );
  return subject && solution && subject.sha256 === solution.sha256;
});

const report = {
  version: 1,
  bac: {
    externalRecords: externalBac.length,
    externalRecordsWithBothZeroHashes: externalBac.filter(
      (exam) =>
        exam.sha256?.exam === zeroSha256 && exam.sha256?.barem === zeroSha256,
    ).length,
    localRecords: localBac.length,
    localRecordsWithMetadataCandidates: new Set(
      localDuplicateCandidates.map((candidate) => candidate.localId),
    ).size,
    duplicateCandidatePairs: localDuplicateCandidates.length,
    duplicateCandidates: localDuplicateCandidates,
  },
  olympiad: {
    documents: olympiadDocuments.length,
    documentsWithoutExplicitGrade: olympiadDocuments.filter(
      (document) => document.grade == null,
    ).length,
    expandedGroups: expandedGroups.length,
    incompleteGroups: incompleteGroups.length,
    reusedDocumentGroups: reusedDocumentGroups.length,
    incompleteGroupKeys: incompleteGroups.map((group) => group.key),
  },
};

if (reportPath) {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
