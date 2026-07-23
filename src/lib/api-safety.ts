import { NextResponse } from "next/server";

const maxJsonBodyBytes = 256 * 1024;
const maxMultipartBodyBytes = 32 * 1024 * 1024;

export function methodNotAllowed(allowed: readonly string[]) {
  return NextResponse.json(
    { error: "Metodă nepermisă." },
    { status: 405, headers: { Allow: allowed.join(", ") } },
  );
}

export function requestBodyTooLarge(request: Request, kind: "json" | "multipart") {
  const limit = kind === "json" ? maxJsonBodyBytes : maxMultipartBodyBytes;
  const value = request.headers.get("content-length");
  if (!value) return false;
  const size = Number(value);
  return !Number.isFinite(size) || size > limit;
}

export function unsupportedContentType(request: Request, expected: "application/json" | "multipart/form-data") {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return !contentType.startsWith(expected);
}
