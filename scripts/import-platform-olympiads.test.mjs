import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  REQUIRED_FAMILIES,
  buildPlatformManifest, collectPlatformExams, dedupePlatformExams, runImport,
  sortPlatformExams, validatePlatformExams,
} from "./import-platform-olympiads.mjs";

function makeExam(overrides = {}) {
  return {
    id: "olimpiada-informatica-locala-2026-9-1",
    olympiadSubject: "informatica",
    stage: "locala",
    year: 2026,
    grade: 9,
    title: "Olimpiada de Informatică 2026 · Clasa a 9-a · example",
    platformUrl: "https://kilonova.ro/problems/1?list_id=2",
    provider: "kilonova",
    order: 1,
    ...overrides,
  };
}

function makeFamilyFixtures() {
  return [
    makeExam({ id: "kn-local-1" }),
    makeExam({ id: "kn-county-1", stage: "judeteana" }),
    makeExam({ id: "kn-national-1", stage: "nationala" }),
    makeExam({
      id: "ml-local-1",
      olympiadSubject: "inteligenta-artificiala",
      provider: "mlcompete",
      platformUrl: "https://platform.olimpiada-ai.ro/ro/competitions/1",
    }),
    makeExam({
      id: "cy-jud-1",
      olympiadSubject: "securitate-cibernetica",
      provider: "cyberedu",
      platformUrl: "https://app.cyber-edu.co/competition/oscj26?tenant=cyberedu",
    }),
  ];
}

function kilonovaHtml(listId, year, grades, problems) {
  const ownTitle = `Olimpiada de informatica, etapa, ${year}, clasele ${grades.join("-")}`;
  const problemsHtml = problems
    .map((problemId) => `<a href="/problems/${problemId}?list_id=${listId}"><span>problem-${problemId}(#${problemId})</span></a>`)
    .join("");
  return `<span>${ownTitle} <a href="/problem_lists/${listId}">(#${listId})</a></span>${problemsHtml}`;
}

function mlCompeteHtml(entries) {
  return entries
    .map(({ id, stage }) => `<a href="/ro/competitions/${id}"><h2>Olimpiada Națională de Inteligență Artificială 2026 Etapa ${stage}</h2></a>`)
    .join("");
}

function htmlResponse(body) {
  return { ok: true, status: 200, statusText: "OK", text: async () => body };
}

function makeNetworkStub(overrides = {}) {
  const kilonova = overrides.kilonova ?? {};
  const mlcompete = overrides.mlcompete ?? [
    { id: "10", stage: "Locală" },
    { id: "20", stage: "Județeană" },
    { id: "30", stage: "Națională" },
  ];
  return vi.fn(async (url) => {
    if (url === "https://kilonova.ro/problem_lists/1366") {
      return htmlResponse(kilonova.local ?? kilonovaHtml(1366, 2026, ["V", "VI"], ["1001", "1002"]));
    }
    if (url === "https://kilonova.ro/problem_lists/452") {
      return htmlResponse(kilonova.county ?? kilonovaHtml(452, 2026, ["V", "VI"], ["2001"]));
    }
    if (url === "https://kilonova.ro/problem_lists/507") {
      return htmlResponse(kilonova.national ?? kilonovaHtml(507, 2026, ["V", "VI"], ["3001"]));
    }
    if (url.startsWith("https://platform.olimpiada-ai.ro/ro/competitions")) {
      return htmlResponse(mlCompeteHtml(mlcompete));
    }
    throw new Error(`unexpected url ${url}`);
  });
}

const tempRoots = [];

async function makeTempDir() {
  const root = await mkdtemp(path.join(tmpdir(), "iabacu-platform-test-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  while (tempRoots.length) {
    const dir = tempRoots.pop();
    await rm(dir, { recursive: true, force: true });
  }
});

describe("importing the module", () => {
  test("exposes pure helpers and constants without touching the network or filesystem", async () => {
    const imported = await import("./import-platform-olympiads.mjs");
    expect(imported.STAGES).toEqual(["locala", "judeteana", "nationala"]);
    expect(imported.PROVIDERS).toEqual(["kilonova", "mlcompete", "cyberedu"]);
    expect(imported.SUBJECTS).toEqual(["informatica", "inteligenta-artificiala", "securitate-cibernetica"]);
    expect(imported.REQUIRED_FAMILIES).toEqual([
      { provider: "kilonova", stage: "locala", label: "Kilonova local" },
      { provider: "kilonova", stage: "judeteana", label: "Kilonova county" },
      { provider: "kilonova", stage: "nationala", label: "Kilonova national" },
      { provider: "mlcompete", stage: null, label: "MLCompete" },
      { provider: "cyberedu", stage: null, label: "CyberEDU" },
    ]);
    expect(typeof imported.validatePlatformExams).toBe("function");
    expect(typeof imported.sortPlatformExams).toBe("function");
    expect(typeof imported.buildPlatformManifest).toBe("function");
    expect(typeof imported.collectPlatformExams).toBe("function");
    expect(typeof imported.runImport).toBe("function");
  });
});

describe("validatePlatformExams", () => {
  test("accepts a payload that satisfies every required family", () => {
    const exams = makeFamilyFixtures();
    expect(validatePlatformExams(exams)).toEqual([]);
  });

  test("rejects payloads that are not arrays", () => {
    expect(validatePlatformExams(null)).toEqual(["Exams payload must be an array."]);
    expect(validatePlatformExams({ exams: [] })).toEqual(["Exams payload must be an array."]);
  });

  test("rejects records missing required string fields", () => {
    const fixtures = makeFamilyFixtures();
    for (const field of ["id", "olympiadSubject", "stage", "title", "platformUrl", "provider"]) {
      const invalid = [...fixtures.slice(0, -1), { ...makeExam(), [field]: "" }, fixtures.at(-1)];
      const errors = validatePlatformExams(invalid);
      assert.ok(
        errors.some((error) => error.includes(`exams[${invalid.length - 2}].${field}`)),
        `expected error for ${field}, got: ${JSON.stringify(errors)}`,
      );
    }
  });

  test("rejects unknown subjects, stages, and providers", () => {
    const fixtures = makeFamilyFixtures();
    const badSubject = validatePlatformExams([
      ...fixtures.slice(0, 4),
      { ...fixtures[4], olympiadSubject: "physics" },
    ]);
    assert.ok(badSubject.some((error) => error.includes("olympiadSubject")));
    const badProvider = validatePlatformExams([
      ...fixtures.slice(0, 4),
      { ...fixtures[4], provider: "vendor" },
    ]);
    assert.ok(badProvider.some((error) => error.includes("provider")));
  });

  test("rejects year and grade values outside the configured ranges", () => {
    const fixtures = makeFamilyFixtures();
    const outOfRangeYear = validatePlatformExams([...fixtures.slice(0, 4), { ...fixtures[4], year: 1999 }]);
    const outOfRangeGrade = validatePlatformExams([...fixtures.slice(0, 4), { ...fixtures[4], grade: 13 }]);
    const outOfRangeLowGrade = validatePlatformExams([...fixtures.slice(0, 4), { ...fixtures[4], grade: 4 }]);
    assert.ok(outOfRangeYear.some((error) => error.includes(".year:")));
    assert.ok(outOfRangeGrade.some((error) => error.includes(".grade:")));
    assert.ok(outOfRangeLowGrade.some((error) => error.includes(".grade:")));
  });

  test("rejects non-https platformUrl values", () => {
    const fixtures = makeFamilyFixtures();
    const insecure = validatePlatformExams([...fixtures.slice(0, 4), { ...fixtures[4], platformUrl: "http://insecure.example" }]);
    assert.ok(insecure.some((error) => error.includes(".platformUrl: must be a valid https:// URL.")));
    const garbage = validatePlatformExams([...fixtures.slice(0, 4), { ...fixtures[4], platformUrl: "not a url" }]);
    assert.ok(garbage.some((error) => error.includes(".platformUrl:")));
  });

  test("rejects non-integer and negative order values", () => {
    const fixtures = makeFamilyFixtures();
    const negative = validatePlatformExams([...fixtures.slice(0, 4), { ...fixtures[4], order: -1 }]);
    const fractional = validatePlatformExams([...fixtures.slice(0, 4), { ...fixtures[4], order: 1.5 }]);
    const stringy = validatePlatformExams([...fixtures.slice(0, 4), { ...fixtures[4], order: "1" }]);
    assert.ok(negative.some((error) => error.includes(".order:")));
    assert.ok(fractional.some((error) => error.includes(".order:")));
    assert.ok(stringy.some((error) => error.includes(".order:")));
  });

  test("rejects duplicate ids", () => {
    const fixtures = makeFamilyFixtures();
    const duplicate = [fixtures[0], { ...fixtures[0], stage: "judeteana" }, ...fixtures.slice(2)];
    const errors = validatePlatformExams(duplicate);
    assert.ok(errors.some((error) => error.includes("duplicate id")));
  });

  test("rejects empty families so markup drift cannot silently write a partial index", () => {
    const fixtures = makeFamilyFixtures();
    for (const family of REQUIRED_FAMILIES) {
      const matching = fixtures.filter((exam) => {
        if (exam.provider !== family.provider) return false;
        if (family.stage !== null && exam.stage !== family.stage) return false;
        return true;
      });
      const withoutFamily = fixtures.filter((exam) => !matching.includes(exam));
      const errors = validatePlatformExams(withoutFamily);
      assert.ok(
        errors.some((error) => error.startsWith(`${family.label}:`)),
        `expected an error for missing family ${family.label}, got: ${JSON.stringify(errors)}`,
      );
    }
  });

  test("rejects empty arrays outright", () => {
    const errors = validatePlatformExams([]);
    assert.equal(errors.length, REQUIRED_FAMILIES.length);
  });
});

describe("sortPlatformExams", () => {
  test("orders by descending year, ascending grade, ascending order, then provider, then id", () => {
    const exams = [
      makeExam({ id: "a", year: 2025, grade: 12, order: 50, provider: "kilonova" }),
      makeExam({ id: "b", year: 2026, grade: 9, order: 5, provider: "mlcompete" }),
      makeExam({ id: "c", year: 2026, grade: 9, order: 2, provider: "kilonova" }),
      makeExam({ id: "d", year: 2026, grade: 9, order: 2, provider: "mlcompete" }),
      makeExam({ id: "e", year: 2026, grade: 10, order: 0 }),
    ];
    expect(sortPlatformExams(exams).map((exam) => exam.id)).toEqual(["c", "d", "b", "e", "a"]);
  });

  test("returns a new array and does not mutate the input", () => {
    const exams = [makeExam({ id: "a" }), makeExam({ id: "b", year: 2025 })];
    const original = [...exams];
    const sorted = sortPlatformExams(exams);
    expect(sorted).not.toBe(exams);
    expect(exams).toEqual(original);
  });
});

describe("dedupePlatformExams", () => {
  test("keeps the first occurrence of each id and drops the rest", () => {
    const exams = [
      makeExam({ id: "a" }),
      makeExam({ id: "a", stage: "judeteana" }),
      makeExam({ id: "b" }),
      makeExam({ id: "a", order: 99 }),
    ];
    const deduped = dedupePlatformExams(exams);
    expect(deduped.map((exam) => exam.id)).toEqual(["a", "b"]);
    expect(deduped[0].stage).toBe("locala");
  });
});

describe("buildPlatformManifest", () => {
  test("returns the documented manifest shape with sorted, validated exams", () => {
    const exams = makeFamilyFixtures();
    const manifest = buildPlatformManifest(exams, "2026-01-01T00:00:00.000Z");
    expect(manifest.version).toBe(1);
    expect(manifest.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(manifest.exams.length).toBe(exams.length);
    expect(manifest.exams).toEqual(sortPlatformExams(exams));
  });

  test("throws when validation fails", () => {
    expect(() => buildPlatformManifest([makeExam()])).toThrow(/Invalid platform exams/);
  });
});

describe("collectPlatformExams", () => {
  test("collects all required families from a stubbed network response", async () => {
    const collected = await collectPlatformExams({ fetchImpl: makeNetworkStub() });
    expect(collected.local.length).toBeGreaterThan(0);
    expect(collected.county.length).toBeGreaterThan(0);
    expect(collected.national.length).toBeGreaterThan(0);
    expect(collected.mlcompete.length).toBeGreaterThan(0);
    expect(collected.cyberedu.length).toBe(4);
    // MLCompete fetches the listings twice, so the raw bucket is doubled before dedup.
    const rawCount = collected.local.length
      + collected.county.length
      + collected.national.length
      + collected.mlcompete.length
      + collected.cyberedu.length;
    expect(collected.all.length).toBeLessThanOrEqual(rawCount);
    expect(new Set(collected.all.map((exam) => exam.id)).size).toBe(collected.all.length);
  });

  test("emits an empty MLCompete bucket when the platform markup changes", async () => {
    const fetchImpl = makeNetworkStub({ mlcompete: [] });
    const collected = await collectPlatformExams({ fetchImpl });
    expect(collected.mlcompete).toEqual([]);
    expect(collected.cyberedu.length).toBe(4);
  });
});

describe("runImport", () => {
  test("default mode writes the manifest atomically and leaves no temp file behind", async () => {
    const dir = await makeTempDir();
    const outputPath = path.join(dir, "nested", "olympiad-platform-index.json");
    const result = await runImport({ fetchImpl: makeNetworkStub(), outputPath });
    expect(result.mode).toBe("apply");
    expect(result.outputPath).toBe(outputPath);
    const written = JSON.parse(await readFile(outputPath, "utf8"));
    expect(written.version).toBe(1);
    expect(written.exams.length).toBeGreaterThan(0);
    expect(written.exams).toEqual(sortPlatformExams(written.exams));
    const siblings = (await readdir(dir)).filter((name) => name.endsWith(".tmp"));
    expect(siblings).toEqual([]);
  });

  test("apply: true explicitly writes the manifest atomically", async () => {
    const dir = await makeTempDir();
    const outputPath = path.join(dir, "olympiad-platform-index.json");
    const result = await runImport({ apply: true, fetchImpl: makeNetworkStub(), outputPath });
    expect(result.mode).toBe("apply");
    const written = JSON.parse(await readFile(outputPath, "utf8"));
    expect(written.exams.length).toBeGreaterThan(0);
  });

  test("apply: false is a programmatic dry-run that produces no filesystem writes", async () => {
    const dir = await makeTempDir();
    const outputPath = path.join(dir, "olympiad-platform-index.json");
    const result = await runImport({ apply: false, fetchImpl: makeNetworkStub(), outputPath });
    expect(result.mode).toBe("dry-run");
    expect(result.manifest.exams.length).toBeGreaterThan(0);
    await expect(stat(outputPath)).rejects.toThrow();
  });

  test("apply does not write the destination when a required family is empty", async () => {
    const dir = await makeTempDir();
    const outputPath = path.join(dir, "olympiad-platform-index.json");
    const fetchImpl = makeNetworkStub({ mlcompete: [] });
    await expect(runImport({ apply: true, fetchImpl, outputPath })).rejects.toThrow();
    await expect(stat(outputPath)).rejects.toThrow();
    const siblings = await readdir(dir);
    expect(siblings.filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});
