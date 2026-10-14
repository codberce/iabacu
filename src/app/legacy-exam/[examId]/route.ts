import { legacyExamRedirect } from "@/lib/legacy-exam-redirect";

export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  return legacyExamRedirect(request, (await params).examId, "subject");
}
