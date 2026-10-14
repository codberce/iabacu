// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { publicExamResponse } from "./exam-request";

const path = "https://iabacu.ro/exam/archive-logica-143?from=%2Flogica%3Fyear%3D2014&learningWorkspace=private-id";

describe("cache-safe document requests", () => {
  it("routes old document visits through the private context handler before rendering", () => {
    const response = publicExamResponse(new NextRequest(path))!;
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/document-context");
    const url = new URL(response.headers.get("x-middleware-request-x-exam-navigation-destination")!, "https://iabacu.ro");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("learningWorkspace")).toBe("private-id");
  });

  it("also forwards context when the proxy receives an RSC request", async () => {
    const response = publicExamResponse(new NextRequest(path, { headers: { RSC: "1" } }))!;
    expect(response.status).toBe(200);
    expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/document-context");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("");
  });

  it("returns real 404s before an unknown document can stream a 200 page", () => {
    const response = publicExamResponse(new NextRequest("https://iabacu.ro/exam/bac-2099-missing"))!;
    expect(response.status).toBe(404);
    expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/_not-found");
  });

  it.each(["/exam/archive-logica-143", "/exam/archive-logica-143?_rsc=cache-buster", "/api/learning/workspaces/private?from=private"])("does not alter canonical requests or account APIs: %s", (path) => {
    expect(publicExamResponse(new NextRequest(new URL(path, "https://iabacu.ro")))).toBeNull();
  });
});
