import { describe, expect, it } from "vitest";
import {
  methodNotAllowed,
  requestBodyTooLarge,
  unsupportedContentType,
} from "./api-safety";

describe("API safety", () => {
  it("rejects unsupported content types", () => {
    expect(unsupportedContentType(new Request("https://iabacu.ro/api/test"), "application/json")).toBe(true);
    expect(unsupportedContentType(new Request("https://iabacu.ro/api/test", {
      headers: { "content-type": "application/json; charset=utf-8" },
    }), "application/json")).toBe(false);
  });

  it("rejects bodies above fixed route limits", () => {
    expect(requestBodyTooLarge(new Request("https://iabacu.ro/api/test", {
      headers: { "content-length": String(256 * 1024 + 1) },
    }), "json")).toBe(true);
    expect(requestBodyTooLarge(new Request("https://iabacu.ro/api/test", {
      headers: { "content-length": String(256 * 1024) },
    }), "json")).toBe(false);
  });

  it("returns an explicit Allow header", async () => {
    const response = methodNotAllowed(["POST"]);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(response.json()).resolves.toEqual({ error: "Metodă nepermisă." });
  });
});
