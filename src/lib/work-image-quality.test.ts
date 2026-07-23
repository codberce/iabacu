import { describe, expect, it } from "vitest";
import {
  workImageCompressionTarget,
  workImageQualityIssues,
} from "./work-image-quality";

describe("work image quality", () => {
  it("accepts a clear portrait page", () => {
    expect(
      workImageQualityIssues({
        mimeType: "image/jpeg",
        sizeBytes: 2 * 1024 * 1024,
        width: 2200,
        height: 3200,
      }),
    ).toEqual([]);
  });

  it("warns before sending a low-resolution rotated page", () => {
    expect(
      workImageQualityIssues({
        mimeType: "image/png",
        sizeBytes: 500_000,
        width: 1100,
        height: 700,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "low_resolution", severity: "warning" }),
        expect.objectContaining({ code: "landscape", severity: "warning" }),
      ]),
    );
  });

  it("blocks unreadable, unsupported, and extremely narrow files", () => {
    expect(
      workImageQualityIssues({
        mimeType: "application/pdf",
        sizeBytes: 100,
        width: 0,
        height: 0,
      }).map((issue) => issue.code),
    ).toEqual(["unsupported_type", "unreadable"]);

    expect(
      workImageQualityIssues({
        mimeType: "image/webp",
        sizeBytes: 100_000,
        width: 4000,
        height: 500,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "extreme_aspect_ratio",
          severity: "error",
        }),
      ]),
    );
  });

  it("warns when local compression will be needed", () => {
    expect(
      workImageQualityIssues({
        mimeType: "image/jpeg",
        sizeBytes: 8 * 1024 * 1024,
        width: 2200,
        height: 3200,
      }),
    ).toContainEqual(expect.objectContaining({ code: "large_file" }));
  });

  it("budgets compressed images below both upload limits", () => {
    expect(workImageCompressionTarget(1)).toBe(Math.floor(6.5 * 1024 * 1024));
    expect(workImageCompressionTarget(8)).toBe(Math.floor((26 * 1024 * 1024) / 8));
    expect(workImageCompressionTarget(8) * 8).toBeLessThan(28 * 1024 * 1024);
  });
});
