// @vitest-environment node
import { describe, expect, it } from "vitest";
import { aiUsageHeaders, claimAiUsage, releaseAiUsage } from "./ai-usage";

describe("self-hosted AI usage", () => {
  it("does not require an account or database quota", async () => {
    await expect(claimAiUsage("corrector")).resolves.toEqual({
      unlimited: true,
      used: 0,
      remaining: null,
      limit: null,
    });
  });

  it("can release a request without persistent state", async () => {
    await expect(releaseAiUsage("question")).resolves.toBeUndefined();
  });

  it("formats unlimited response headers", () => {
    expect(
      aiUsageHeaders({ unlimited: true, used: 0, remaining: null, limit: null }),
    ).toEqual({
      "x-ai-limit": "unlimited",
      "x-ai-remaining": "unlimited",
    });
  });
});
