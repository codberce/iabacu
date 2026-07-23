import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "vitest";

const catalogPath = path.resolve("scripts/oradeistorie-istorie-sources.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

describe("oradeistorie-istorie sources catalog", () => {
  it("catalog has the expected top-level shape", () => {
    assert.equal(catalog.version, 1);
    assert.equal(catalog.subject, "istorie");
    assert.equal(catalog.publisher, "Ora de Istorie");
    assert.equal(catalog.publisherUrl, "https://oradeistorie.ro");
    assert.equal(typeof catalog.label, "string");
    assert.ok(catalog.label.length > 0);
    assert.ok(catalog.yearPages && typeof catalog.yearPages === "object");
    assert.ok(catalog.stageMap && typeof catalog.stageMap === "object");
  });

  it("every year page URL matches the expected slug pattern", () => {
    const pattern = /^https:\/\/oradeistorie\.ro\/olimpiada-de-istorie-\d{4}-[a-z0-9-]+\/?$/;
    const years = Object.keys(catalog.yearPages);
    assert.ok(years.length > 0, "yearPages must not be empty");
    for (const [year, url] of Object.entries(catalog.yearPages)) {
      assert.equal(typeof url, "string", `year ${year} url must be a string`);
      assert.match(url, pattern, `year ${year} url ${url} does not match slug pattern`);
      assert.ok(url.includes(`-${year}-`), `year ${year} url must contain -${year}-`);
    }
  });

  it("every catalog year is in the 2003..2026 range", () => {
    const years = Object.keys(catalog.yearPages).map(Number);
    for (const year of years) {
      assert.ok(Number.isInteger(year), `year ${year} must be an integer`);
      assert.ok(year >= 2003 && year <= 2026, `year ${year} out of [2003, 2026] range`);
    }
  });

  it("stageMap is well-formed and covers all four raw stages", () => {
    const expectedKeys = ["locala", "judeteana", "nationala", "scoala"];
    const expectedTargets = ["locala", "judeteana", "nationala"];
    for (const key of expectedKeys) {
      assert.ok(key in catalog.stageMap, `stageMap missing key ${key}`);
    }
    for (const [from, to] of Object.entries(catalog.stageMap)) {
      assert.equal(typeof to, "string", `stageMap.${from} must be a string`);
      assert.ok(expectedTargets.includes(to), `stageMap.${from} -> ${to} must be one of ${expectedTargets.join(", ")}`);
    }
    assert.equal(catalog.stageMap.scoala, "locala", "scoala must be remapped to locala");
  });

  it("2017 is NOT included in the catalog (404 year)", () => {
    assert.ok(!("2017" in catalog.yearPages), "2017 must not be in yearPages");
    const years = Object.keys(catalog.yearPages);
    assert.ok(!years.includes("2017"), "2017 must not appear in the year list");
  });

  it("the catalog covers at least 19 distinct years", () => {
    const years = Object.keys(catalog.yearPages);
    const distinct = new Set(years);
    assert.equal(distinct.size, years.length, "year list must not contain duplicates");
    assert.ok(distinct.size >= 19, `expected at least 19 distinct years, got ${distinct.size}`);
    assert.equal(distinct.size, 20, `expected exactly 20 distinct years, got ${distinct.size}`);
  });

  it("the catalog includes every year in the 2003..2026 range except 2017, 2019, 2021, 2022", () => {
    const expectedMissing = [2017, 2019, 2021, 2022];
    const expectedYears = Array.from({ length: 24 }, (_, index) => 2003 + index)
      .filter((year) => !expectedMissing.includes(year));
    const actualYears = Object.keys(catalog.yearPages).map(Number).toSorted((a, b) => a - b);
    assert.deepEqual(actualYears, expectedYears, "year list should cover all non-missing years");
  });
});
