const MAX_BODY_BYTES = 16 * 1024;

async function bodyTextWithinLimit(request: Request): Promise<string | null> {
  const raw = request.headers.get("content-length");
  if (raw) {
    const size = Number(raw);
    if (Number.isFinite(size) && size > MAX_BODY_BYTES) return null;
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Privacy-safe CSP report collector.
 *
 * Accepts POST requests with a JSON body (application/csp-report,
 * application/reports+json or application/json), validates size and
 * content type, then returns 204 No Content.
 *
 * Only the violated directive and blocked resource origin are logged, so
 * observability can surface violations without retaining page URLs.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isExpected =
    contentType.startsWith("application/csp-report") ||
    contentType.startsWith("application/reports+json") ||
    contentType.startsWith("application/json");
  if (!isExpected) {
    return new Response(null, { status: 415 });
  }

  const text = await bodyTextWithinLimit(request);
  if (text === null) {
    return new Response(null, { status: 413 });
  }

  if (text) {
    try {
      const report = JSON.parse(text);
      const cspReport = report?.["csp-report"] ?? report;
      const blockedUri = cspReport?.["blocked-uri"];
      const blockedOrigin = typeof blockedUri === "string"
        ? (() => {
            try {
              return new URL(blockedUri).origin;
            } catch {
              return blockedUri.split(":", 1)[0] || "unknown";
            }
          })()
        : "unknown";
      if (blockedUri || cspReport?.["violated-directive"]) {
        console.warn("CSP violation", {
          blockedOrigin,
          directive: cspReport?.["violated-directive"] ?? "unknown",
        });
      }
    } catch {
      // Browsers may send an empty or malformed report; never echo it back.
    }
  }

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  return new Response(null, { status: 405 });
}
