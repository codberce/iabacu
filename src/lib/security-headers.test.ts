import config from "../../next.config";
import { describe, expect, it } from "vitest";

describe("security headers", () => {
  it("ships safe baseline headers and report-only CSP", async () => {
    const rules = await config.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    expect(headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    expect(headers).toContainEqual({ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" });
    expect(headers.find((header) => header.key === "Content-Security-Policy-Report-Only")?.value).toContain("frame-ancestors 'self'");
    expect(headers.find((header) => header.key === "Permissions-Policy")?.value).toContain("camera=(self)");
  });
});
