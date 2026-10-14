import { examNavigationResponse } from "@/lib/exam-navigation-response";

export function GET(request: Request) {
  return examNavigationResponse(request);
}
