import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "vitest";
import {
  buildManifest, deduplicateDocuments, findEmptyCataloguedStages, inferCounty,
  inferDocumentMetadata, inferGrade, inferKind, inferLanguage, inferPairKey,
  inferStage, inferYear, validateCatalog,
} from "./olympiad-import-core.mjs";
import { runImport } from "./import-olympiads.mjs";

const catalog = JSON.parse(await readFile(path.resolve("scripts/olympiad-sources.json"), "utf8"));

test("the checked-in catalog declares all subjects and stages", () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.subjects.length, 18);
  for (const subject of catalog.subjects) {
    assert.deepEqual(Object.keys(subject.coverage).sort(), ["judeteana", "locala", "nationala"]);
  }
});

test("metadata inference handles Romanian archive naming", () => {
  const value = "OJ_2026_Fizica/judetul_Iasi/clasa_a_X-a/proba_teoretica_subiecte_RO.pdf";
  assert.equal(inferYear(value), 2026);
  assert.equal(inferStage(value), "judeteana");
  assert.equal(inferGrade(value), 10);
  assert.equal(inferKind(value), "subject");
  assert.equal(inferLanguage(value), "ro");
  assert.equal(inferCounty(value), "Iași");
  assert.equal(inferLanguage("subiect_LMA.pdf"), "hu");
  assert.equal(inferLanguage("subiect_LGE.pdf"), "de");
});

test("international competitions are not mislabeled as the national stage", () => {
  assert.equal(
    inferStage("Olimpiada Internațională Pluridisciplinară Tuymaada"),
    undefined,
  );
});

test("explicit metadata wins over ambiguous filenames", () => {
  assert.deepEqual(
    inferDocumentMetadata("etapa nationala 2024 clasele 9 si 10 barem", {
      subject: "chimie", stage: "locala", year: 2025, grade: 11, kind: "subject", language: "hu", county: "Cluj",
    }),
    { olympiadSubject: "chimie", stage: "locala", year: 2025, grade: 11, kind: "subject", language: "hu", county: "Cluj" },
  );
});

test("pair keys associate roles but preserve probe and variant", () => {
  const metadata = { olympiadSubject: "fizica", stage: "nationala", year: 2025, grade: 10, language: "ro" };
  const subject = inferPairKey("clasa_X_proba_teoretica_varianta_2_subiect.pdf", metadata);
  const solution = inferPairKey("clasa_X_proba_teoretica_varianta_2_barem.pdf", metadata);
  const practical = inferPairKey("clasa_X_proba_practica_varianta_2_barem.pdf", metadata);
  assert.equal(subject, solution);
  assert.notEqual(subject, practical);
  assert.match(subject, /proba-teoretica-varianta-2/);
});

test("Romanian role abbreviations pair var with bar", () => {
  const metadata = { olympiadSubject: "limbi-romanice", stage: "judeteana", year: 2026, grade: 10, language: "it" };
  assert.equal(
    inferPairKey("italiana_scris_10_bilingv_var_judet.pdf", metadata),
    inferPairKey("italiana_scris_10_bilingv_bar_judet.pdf", metadata),
  );
  assert.equal(inferKind("proba_sub.pdf"), "subject");
  assert.equal(inferKind("proba_bar.pdf"), "solution");
});

test("deduplication merges exact records but preserves semantic hash reuse", () => {
  const base = {
    id: "a", olympiadSubject: "fizica", stage: "judeteana", year: 2026,
    grade: 10, kind: "subject", language: "ro", pairKey: "teoretica",
    sha256: "a".repeat(64), size: 10, assetKey: `pdf/${"a".repeat(64)}.pdf`,
    provenance: [{ sourceId: "one", sourceUrl: "https://one.example" }],
  };
  const exactDuplicate = { ...base, id: "b", provenance: [{ sourceId: "two", sourceUrl: "https://two.example" }] };
  const otherProbe = { ...base, id: "c", pairKey: "practica" };
  const documents = deduplicateDocuments([base, exactDuplicate, otherProbe]);
  assert.equal(documents.length, 2);
  assert.equal(documents[0].provenance.length, 2);
  const manifest = buildManifest({
    documents,
    outcomes: [],
    coverage: [{ olympiadSubject: "fizica", stage: "locala", status: "unavailable", note: "No audited archive." }],
    catalogVersion: 2,
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.duplicateContentGroups.length, 1);
  assert.deepEqual(manifest.gaps, [{ olympiadSubject: "fizica", stage: "locala", status: "unavailable", reason: "No audited archive." }]);
});

test("default run is a network-free, write-free plan", async () => {
  const result = await runImport({ catalog, subjectFilter: "limba-germana-moderna" });
  assert.equal(result.mode, "dry-run");
  assert.equal(result.documents.length, 0);
  assert.ok(result.outcomes.length > 0);
  assert.ok(result.outcomes.every((outcome) => outcome.status === "planned"));
});


test("non-mathematics catalogued stages must have at least one verified document", async () => {
  const manifest = JSON.parse(await readFile(path.resolve("src/data/olympiad-subject-index.json"), "utf8"));
  const empty = findEmptyCataloguedStages(manifest.documents, manifest.coverage);
  assert.deepEqual(empty, [], `Empty catalogued stages: ${JSON.stringify(empty)}`);
});

test("checked-in catalog marks German local/national and Junior local/national as unavailable", () => {
  const unavailable = catalog.subjects.flatMap((subject) =>
    Object.entries(subject.coverage)
      .filter(([, detail]) => detail.status === "unavailable")
      .map(([stage, detail]) => ({ olympiadSubject: subject.id, stage, note: detail.note })),
  );
  for (const expected of [
    { olympiadSubject: "limba-germana-moderna", stage: "locala" },
    { olympiadSubject: "limba-germana-moderna", stage: "nationala" },
    { olympiadSubject: "stiinte-pentru-juniori", stage: "locala" },
    { olympiadSubject: "stiinte-pentru-juniori", stage: "nationala" },
  ]) {
    const match = unavailable.find((entry) => entry.olympiadSubject === expected.olympiadSubject && entry.stage === expected.stage);
    assert.ok(match, `expected ${expected.olympiadSubject}/${expected.stage} to be unavailable`);
    assert.match(match.note ?? "", /[\p{L}]/u, "unavailable note should contain a Romanian explanation");
  }
});

test("buildManifest emits stage-specific unavailable gaps even when a failed source gap exists", () => {
  const manifest = buildManifest({
    documents: [],
    outcomes: [{
      sourceId: "olimpiade-ro-germana-moderna",
      olympiadSubject: "limba-germana-moderna",
      stage: "locala",
      status: "failed",
      reason: "Source adapter discovered no matching files.",
    }],
    coverage: [
      { olympiadSubject: "limba-germana-moderna", stage: "locala", status: "unavailable", note: "Nu am încă arhive verificate." },
      { olympiadSubject: "limba-germana-moderna", stage: "nationala", status: "unavailable", note: "Nu am încă arhive verificate." },
      { olympiadSubject: "limba-germana-moderna", stage: "judeteana", status: "catalogued" },
    ],
    catalogVersion: 2,
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  // The failed source gap must be preserved as-is.
  const sourceGap = manifest.gaps.find((gap) => gap.sourceId === "olimpiade-ro-germana-moderna");
  assert.ok(sourceGap, "failed source gap should be preserved");
  assert.equal(sourceGap.status, "failed");
  // Both unavailable stages must appear as stage-specific gaps, even though one overlaps with a source gap.
  const localGap = manifest.gaps.find((gap) => gap.olympiadSubject === "limba-germana-moderna" && gap.stage === "locala" && gap.status === "unavailable");
  const nationalGap = manifest.gaps.find((gap) => gap.olympiadSubject === "limba-germana-moderna" && gap.stage === "nationala" && gap.status === "unavailable");
  assert.ok(localGap, "locala unavailable coverage gap should be emitted");
  assert.equal(localGap.reason, "Nu am încă arhive verificate.");
  assert.ok(nationalGap, "nationala unavailable coverage gap should be emitted");
  // And the catalogued stage should not produce a gap.
  assert.ok(!manifest.gaps.some((gap) => gap.olympiadSubject === "limba-germana-moderna" && gap.stage === "judeteana" && gap.status === "unavailable"));
});

test("checked-in manifest exposes the expected unavailable gaps for German and Junior Science", async () => {
  const manifest = JSON.parse(await readFile(path.resolve("src/data/olympiad-subject-index.json"), "utf8"));
  const coverageGaps = manifest.gaps.filter((gap) => gap.status === "unavailable");
  for (const expected of [
    { olympiadSubject: "limba-germana-moderna", stage: "locala" },
    { olympiadSubject: "limba-germana-moderna", stage: "nationala" },
    { olympiadSubject: "stiinte-pentru-juniori", stage: "locala" },
    { olympiadSubject: "stiinte-pentru-juniori", stage: "nationala" },
  ]) {
    assert.ok(
      coverageGaps.some((gap) => gap.olympiadSubject === expected.olympiadSubject && gap.stage === expected.stage),
      `expected manifest.gaps to include unavailable ${expected.olympiadSubject}/${expected.stage}`,
    );
  }
});
