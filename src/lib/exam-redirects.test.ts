// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getRedirectUrl, getRewrittenUrl, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

describe("exam alias routing", () => {
  it.each(["", "/barem"])("redirects a Bac alias and retains query parameters: %s", async (suffix) => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig,
      url: `https://www.iabacu.ro/exam/archive-logica-872${suffix}?from=%2Flogica%3Fyear%3D2025`,
    });
    expect(response.status).toBe(308);
    const destination = new URL(getRedirectUrl(response)!);
    expect(destination.pathname).toBe(`/exam/archive-logica-143${suffix}`);
    expect(destination.searchParams.get("from")).toBe("/logica?year=2025");
  });

  it.each(["", "/barem"])("rewrites only legacy olympiad paths to a request-time redirect: %s", async (suffix) => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig,
      url: `https://www.iabacu.ro/exam/olympiad:5:document${suffix}?from=%2Folimpiade`,
    });
    const destination = new URL(getRewrittenUrl(response)!);
    expect(decodeURIComponent(destination.pathname)).toBe(`/legacy-exam/olympiad:5:document${suffix}`);
    expect(destination.searchParams.get("from")).toBe("/olimpiade");
  });

  it("leaves canonical workspace paths on the cached page route", async () => {
    const response = await unstable_getResponseFromNextConfig({ nextConfig, url: "https://www.iabacu.ro/exam/bac-2026-model-model-oficial?from=%2Fmatematica" });
    expect(getRewrittenUrl(response)).toBeNull();
    expect(getRedirectUrl(response)).toBeNull();
  });

  it.each(["", "/barem"])("also routes URL-encoded legacy IDs: %s", async (suffix) => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig,
      url: `https://www.iabacu.ro/exam/olympiad%3A5%3Adocument${suffix}?from=%2Folimpiade`,
    });
    const destination = new URL(getRewrittenUrl(response)!);
    expect(decodeURIComponent(destination.pathname)).toBe(`/legacy-exam/olympiad:5:document${suffix}`);
    expect(destination.searchParams.get("from")).toBe("/olimpiade");
  });
});
