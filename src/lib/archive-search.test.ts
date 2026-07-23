import { describe, expect, it } from "vitest";
import {
  archiveDefaultFilters,
  archiveFiltersFromRecord,
  archiveFiltersFromSearchParams,
  archiveSearchIncludes,
  archiveSearchParams,
  normalizeArchiveSearch,
} from "./archive-search";

describe("archive search", () => {
  it("matches Romanian names without requiring diacritics", () => {
    expect(normalizeArchiveSearch("Română · Bacău")).toBe("romana · bacau");
    expect(archiveSearchIncludes("Sesiunea Română · Bacău", "romana bacau")).toBe(true);
  });

  it("parses only known values and serializes a canonical URL", () => {
    const filters = archiveFiltersFromSearchParams(new URLSearchParams("q=  bacau  &year=2025&session=final&profile=M1&progress=started&sort=oldest"), { years: [2026, 2025], sessions: ["final"], profiles: ["M1"] });
    expect(filters).toEqual({ q: "bacau", year: 2025, session: "final", profile: "M1", progress: "started", sort: "oldest" });
    expect(archiveSearchParams(new URLSearchParams("utm=x&sort=newest"), filters)).toBe("utm=x&sort=oldest&q=bacau&year=2025&session=final&profile=M1&progress=started");
  });

  it("supports a useful default year while keeping all years shareable", () => {
    const options = {
      years: [2026, 2025],
      sessions: ["final"],
      profiles: ["M1"],
      defaultYear: 2026,
    } as const;
    expect(archiveFiltersFromRecord({}, options).year).toBe(2026);
    expect(archiveFiltersFromRecord({ year: "all" }, options).year).toBe("all");

    const defaults = { ...archiveDefaultFilters, year: 2026 as const };
    expect(
      archiveSearchParams(
        new URLSearchParams(),
        { ...defaults, year: "all" },
        defaults,
      ),
    ).toBe("year=all");
  });
});
