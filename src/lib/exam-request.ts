import { NextRequest, NextResponse } from "next/server";
import { examQueryRedirect } from "@/lib/return-path";
import { isKnownExamRoute } from "@/lib/exam-route-exists";

export function publicExamResponse(request: NextRequest): NextResponse | null {
  const destination = examQueryRedirect(new URL(request.url));
  if (destination) {
    // Proxy normalization hides Flight headers. A route handler can see them
    // and preserve old in-app links as well as full document visits.
    const headers = new Headers(request.headers);
    headers.set("x-exam-navigation-destination", `${destination.pathname}${destination.hash}`);
    const response = NextResponse.rewrite(new URL("/document-context", request.url), { request: { headers } });
    response.headers.set("cache-control", "private, no-store");
    return response;
  }
  if (isKnownExamRoute(request.nextUrl.pathname) === false) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  return null;
}
