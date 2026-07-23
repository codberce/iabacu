import config from "../../next.config";
import { describe, expect, it } from "vitest";

describe("security headers", () => {
  it("ships safe baseline headers", async () => {
    const rules = await config.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    expect(headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    expect(headers).toContainEqual({ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" });
    expect(headers.find((header) => header.key === "Permissions-Policy")?.value).toContain("camera=(self)");
  });

  it("includes report-only CSP with modern directives", async () => {
    const rules = await config.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    const csp = headers.find((h) => h.key === "Content-Security-Policy-Report-Only")?.value;
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("report-uri /api/csp-report");
  });

  it("allows unsafe-inline scripts for Next.js in report-only CSP", async () => {
    const rules = await config.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    const csp = headers.find((h) => h.key === "Content-Security-Policy-Report-Only")?.value;
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain("'unsafe-eval'");
  });
});
