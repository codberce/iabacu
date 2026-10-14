import { NextRequest, NextResponse } from "next/server";
import { examQueryRedirect } from "@/lib/return-path";
import { isKnownExamRoute } from "@/lib/exam-route-exists";

export function publicExamResponse(request: NextRequest): NextResponse | null {
  const destination = examQueryRedirect(new URL(request.url));
  if (destination) {
    if (request.headers.get("RSC") === "1") {
      // Fetch redirects lose URL fragments. Older cached clients must first
      // perform a full navigation, whose redirect preserves the context.
      return new NextResponse("", {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
      });
    }
    const response = NextResponse.redirect(destination, 307);
    response.headers.set("cache-control", "private, no-store");
    return response;
  }
  if (isKnownExamRoute(request.nextUrl.pathname) === false) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  return null;
}
