import { describe, expect, it } from "vitest";
import {
  gradingProgress,
  gradingStageMessage,
  gradingStages,
} from "./grading-progress";

describe("gradingProgress", () => {
  it("returns 0 at the start", () => {
    expect(gradingProgress(0)).toBe(0);
    expect(gradingProgress(-500)).toBe(0);
  });

  it("increases monotonically over time", () => {
    const values = [0, 3_000, 6_000, 9_000, 12_000, 15_000].map((ms) =>
      gradingProgress(ms),
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it("never reaches 100% before completion", () => {
    expect(gradingProgress(60_000)).toBeLessThanOrEqual(95);
  });

  it("reaches roughly 50% at the base grading time", () => {
    expect(gradingProgress(9_000)).toBeGreaterThanOrEqual(48);
    expect(gradingProgress(9_000)).toBeLessThanOrEqual(55);
  });

  it("adjusts expected time based on image count", () => {
    const singleImage = gradingProgress(9_000, 1);
    const fourImages = gradingProgress(9_000, 4);
    expect(fourImages).toBeLessThan(singleImage);
  });

  it("reaches 50% faster with more images", () => {
    const singleImageTime = gradingProgress(9_000, 1);
    const eightImagesTime = gradingProgress(9_000 + 7 * 80, 8);
    expect(Math.abs(singleImageTime - eightImagesTime)).toBeLessThanOrEqual(5);
  });
});

describe("gradingStageMessage", () => {
  it("returns the first message at t=0", () => {
    expect(gradingStageMessage(0)).toBe(gradingStages[0].message);
  });

  it("advances through stages as time passes", () => {
    expect(gradingStageMessage(3_000)).toContain("Trimitem");
    expect(gradingStageMessage(6_000)).toContain("citește");
    expect(gradingStageMessage(8_000)).toContain("baremul");
    expect(gradingStageMessage(9_000)).toContain("punctajul");
  });

  it("stays on the last stage indefinitely", () => {
    expect(gradingStageMessage(60_000)).toBe(
      gradingStages[gradingStages.length - 1].message,
    );
  });
});