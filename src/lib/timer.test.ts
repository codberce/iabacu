import { describe, expect, it } from "vitest";
import {
  EXAM_DURATION_SECONDS,
  formatDuration,
  remainingSeconds,
} from "./timer";

describe("timer helpers", () => {
  it("counts down from three hours", () => {
    expect(remainingSeconds(1_000, 1_000)).toBe(EXAM_DURATION_SECONDS);
    expect(remainingSeconds(1_000, 61_000)).toBe(EXAM_DURATION_SECONDS - 60);
    expect(remainingSeconds(1_000, 20_000_000)).toBe(0);
  });

  it("formats duration as HH:MM:SS", () => {
    expect(formatDuration(10_800)).toBe("03:00:00");
    expect(formatDuration(61)).toBe("00:01:01");
    expect(formatDuration(-12)).toBe("00:00:00");
  });
});
