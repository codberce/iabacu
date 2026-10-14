// @vitest-environment node
import { describe, expect, it } from "vitest";
import { examNavigationResponse } from "./exam-navigation-response";

function request(target?: string, rsc = false) {
  const headers = new Headers();
  if (target) headers.set("x-exam-navigation-destination", target);
  if (rsc) headers.set("RSC", "1");
  return new Request("https://iabacu.ro/document-context", { headers });
}

describe("legacy document navigation", () => {
  it("redirects document visits to same-origin browser context", () => {
    const response = examNavigationResponse(request("/exam/example#from=%2Fmatematica%3Fyear%3D2026"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://iabacu.ro/exam/example#from=%2Fmatematica%3Fyear%3D2026");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("uses the RSC header at the route handler to trigger a full navigation", async () => {
    const response = examNavigationResponse(request("/exam/example#from=%2Fmatematica", true));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("");
  });

  it.each([undefined, "https://example.com/exam/example", "/invata/private", "/exam/example?learningWorkspace=private"])("rejects an unsafe or missing target: %s", (target) => {
    expect(examNavigationResponse(request(target)).status).toBe(400);
  });
});
