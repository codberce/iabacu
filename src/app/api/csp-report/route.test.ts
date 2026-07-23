// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST, GET } from "./route";

function cspReportRequest(body: unknown, contentType = "application/csp-report") {
  return new Request("https://iabacu.ro/api/csp-report", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });
}

describe("CSP report endpoint", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records a sanitized valid CSP report and returns 204", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await POST(
      cspReportRequest({
        "csp-report": {
          "document-uri": "https://www.iabacu.ro/",
          "blocked-uri": "https://evil.com/script.js",
          "violated-directive": "script-src 'self'",
        },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(warn).toHaveBeenCalledWith("CSP violation", {
      blockedOrigin: "https://evil.com",
      directive: "script-src 'self'",
    });
  });

  it("returns 204 for a valid CSP report with application/json", async () => {
    const response = await POST(
      cspReportRequest(
        { "csp-report": { "document-uri": "https://www.iabacu.ro/" } },
        "application/json",
      ),
    );
    expect(response.status).toBe(204);
  });

  it("rejects non-POST methods", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
  });

  it("rejects unsupported content types", async () => {
    const response = await POST(
      new Request("https://iabacu.ro/api/csp-report", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "hello",
      }),
    );
    expect(response.status).toBe(415);
  });

  it("rejects oversized bodies via content-length", async () => {
    const largeBody = { "csp-report": { "blocked-uri": "x".repeat(20_000) } };
    const response = await POST(cspReportRequest(largeBody));
    expect(response.status).toBe(413);
  });

  it("returns 204 for empty body (edge case)", async () => {
    const response = await POST(
      new Request("https://iabacu.ro/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: "",
      }),
    );
    expect(response.status).toBe(204);
  });

  it("tolerates malformed JSON without crashing", async () => {
    const response = await POST(
      new Request("https://iabacu.ro/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json-at-all",
      }),
    );
    expect(response.status).toBe(204);
  });
});
