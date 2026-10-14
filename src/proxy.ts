import { NextRequest, NextResponse } from "next/server";
import { publicExamResponse } from "@/lib/exam-request";

export default function proxy(request: NextRequest) {
  return publicExamResponse(request) ?? NextResponse.next();
}

export const config = { matcher: ["/exam/:path*"] };
