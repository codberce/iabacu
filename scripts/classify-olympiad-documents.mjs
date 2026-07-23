import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "src", "data", "olympiad.json");
const reportPath = path.join(root, ".cache", "olympiad-classification-report.json");
const apply = process.argv.includes("--apply");
const grades = new Set([5, 6, 7, 8, 9, 10, 11, 12]);

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("ro");
}

function slug(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "standard";
}

function evidence(source, fragment, rule) {
  return { source, fragment, rule };
}

function classifyGrade(document) {
  if (grades.has(document.grade)) {
    return {
      status: "confirmed",
      grade: document.grade,
      evidence: evidence("source-metadata", String(document.grade), "catalog-grade"),
    };
  }

  const title = normalize(`${document.id} ${document.title}`);
  const exact = [
    ...title.matchAll(/(?:clasa|cls|cl)[ ._-]*(?:a[ ._-]*)?(5|6|7|8|9|10|11|12)\b/g),
  ].map((match) => Number(match[1]));
  const unique = [...new Set(exact)];
  if (unique.length === 1) {
    return {
      status: "inferred",
      grade: unique[0],
      evidence: evidence("filename-path", document.title, "explicit-grade-token"),
    };
  }

  return {
    status: "unknown",
    grade: null,
    evidence: evidence("filename-path", document.title, "no-unambiguous-grade-token"),
  };
}

function classifyLanguage(document) {
  const title = normalize(`${document.id} ${document.title}`);
  if (/\b(?:hu|maghiar|maghiara|magyar)\b/.test(title)) {
    return {
      value: "hu",
      evidence: evidence("filename-path", document.title, "hungarian-language-token"),
    };
  }
  if (/\b(?:ro|romana|romanesc|romanian)\b/.test(title)) {
    return {
      value: "ro",
      evidence: evidence("filename-path", document.title, "romanian-language-token"),
    };
  }
  return {
    value: "ro",
    evidence: evidence("source-metadata", document.sourceUrl, "default-romanian-archive-language"),
  };
}

function classifyVariant(document) {
  const title = normalize(document.title);
  const explicit = title.match(/\b(?:varianta|variant|v)\s*([0-9]+|[a-z])\b/);
  if (explicit) {
    return {
      value: `v${explicit[1]}${document.kind === "combined" ? "-combined" : ""}`,
      evidence: evidence("filename-path", document.title, "explicit-variant-token"),
    };
  }

  // This identifier is a repeatable filename-derived association key, not a
  // claim that two documents are equivalent. The strict group builder still
  // requires exactly one document for each role before exposing a pair.
  const stem = slug(
    title
      .replace(/\b(?:subiecte?|enunturi?|bareme?|barem|solutii?|solutii|rezolvari?|raspunsuri?)\b/g, " ")
      .replace(/\b(?:clasa|cls|cl)\s*(?:a\s*)?(?:5|6|7|8|9|10|11|12)\b/g, " ")
      .replace(/\b(?:ro|hu|romana|maghiar(?:a)?)\b/g, " "),
  );
  return {
    value: `filename-${stem}${document.kind === "combined" ? "-combined" : ""}`,
    evidence: evidence("filename-path", document.title, "normalized-filename-stem"),
  };
}

function classify(document) {
  const gradeAssignment = classifyGrade(document);
  const languageAssignment = classifyLanguage(document);
  return {
    ...document,
    ...(gradeAssignment.status !== "unknown" ? { grade: gradeAssignment.grade } : {}),
    geographicScope: {
      value: document.county ? "county" : "national",
      evidence: evidence("source-metadata", document.county ?? document.stage, "catalog-scope"),
    },
    gradeAssignment,
    roleAssignment: {
      value: document.kind,
      evidence: evidence("source-metadata", document.kind, "catalog-document-kind"),
    },
    language: languageAssignment.value,
    languageEvidence: languageAssignment.evidence,
    variantId: classifyVariant(document).value,
    variantEvidence: classifyVariant(document).evidence,
    classificationConfidence:
      gradeAssignment.status === "confirmed" ? "confirmed" : gradeAssignment.status,
  };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const documents = manifest.documents.map(classify);
const roleGroups = new Map();
for (const document of documents) {
  if (document.gradeAssignment.status === "unknown") continue;
  const key = [document.stage, document.year, document.county ?? "", document.grade, document.language, document.variantId, document.kind].join(":");
  roleGroups.set(key, [...(roleGroups.get(key) ?? []), document]);
}
for (const duplicates of roleGroups.values()) {
  if (duplicates.length < 2) continue;
  for (const document of duplicates) {
    document.variantId = `${document.variantId}-${document.sha256.slice(0, 8)}`;
    document.variantEvidence = evidence("filename-path", document.title, "duplicate-role-quarantined-as-distinct-variant");
  }
}
const associationGroups = new Map();
for (const document of documents) {
  if (document.gradeAssignment.status === "unknown") continue;
  const key = [document.stage, document.year, document.county ?? "", document.grade, document.language, document.variantId].join(":");
  associationGroups.set(key, [...(associationGroups.get(key) ?? []), document]);
}
for (const candidates of associationGroups.values()) {
  const subject = candidates.find((document) => document.kind === "subject");
  const rubric = candidates.find((document) => document.kind === "solution");
  if (subject && rubric && subject.sha256 === rubric.sha256) {
    rubric.variantId = `${rubric.variantId}-${rubric.sha256.slice(0, 8)}`;
    rubric.variantEvidence = evidence("filename-path", rubric.title, "same-asset-role-conflict-quarantined-as-distinct-variant");
  }
}
const summary = documents.reduce(
  (result, document) => {
    result[document.gradeAssignment.status] += 1;
    result.languages[document.language] = (result.languages[document.language] ?? 0) + 1;
    return result;
  },
  { confirmed: 0, inferred: 0, unknown: 0, languages: {} },
);
const report = {
  version: 1,
  manifestGeneratedAt: manifest.generatedAt,
  summary,
  unknownGradeDocumentIds: documents
    .filter((document) => document.gradeAssignment.status === "unknown")
    .map((document) => document.id),
};

if (apply) {
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...manifest, classificationVersion: 1, documents }, null, 2)}\n`,
  );
  console.log(`Applied deterministic classifications to ${documents.length} documents.`);
} else {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `Dry run: ${summary.confirmed} confirmed, ${summary.inferred} inferred, ${summary.unknown} quarantined. Report: ${path.relative(root, reportPath)}`,
  );
}
