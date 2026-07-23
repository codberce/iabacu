import { describe, expect, it, vi } from "vitest";
import { orderWorkPages, WORK_DRAFT_TTL_MS } from "./work-draft-store";

describe("work draft utilities", () => {
  it("orders pages using their natural file numbering", () => {
    expect(orderWorkPages([{ name: "page-10.jpg" }, { name: "page-2.jpg" }, { name: "page-1.jpg" }]).map((page) => page.name)).toEqual(["page-1.jpg", "page-2.jpg", "page-10.jpg"]);
  });

  it("exposes a finite two-week recovery window", () => {
    expect(WORK_DRAFT_TTL_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it("does not require browser storage to order incoming pages", () => {
    vi.stubGlobal("window", undefined);
    expect(orderWorkPages([{ name: "2.jpg" }, { name: "1.jpg" }]).map((page) => page.name)).toEqual(["1.jpg", "2.jpg"]);
    vi.unstubAllGlobals();
  });
});
