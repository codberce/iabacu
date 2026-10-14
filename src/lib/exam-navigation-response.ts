const privateHeaders = { "cache-control": "private, no-store" };

export function examNavigationResponse(request: Request): Response {
  const target = request.headers.get("x-exam-navigation-destination");
  if (!target?.startsWith("/exam/")) return new Response(null, { status: 400, headers: privateHeaders });
  const origin = new URL(request.url).origin;
  const destination = new URL(target, origin);
  if (destination.origin !== origin || !/^\/exam\/[^/]+(?:\/barem)?\/?$/.test(destination.pathname) || destination.search) {
    return new Response(null, { status: 400, headers: privateHeaders });
  }
  if (request.headers.get("RSC") === "1") {
    // Fetch redirects lose fragments. A non-Flight response makes Next.js
    // navigate to the original URL before its document redirect runs.
    return new Response("", { headers: { ...privateHeaders, "content-type": "text/html; charset=utf-8" } });
  }
  return new Response(null, { status: 307, headers: { ...privateHeaders, location: destination.href } });
}
