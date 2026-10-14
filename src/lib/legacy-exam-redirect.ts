import { getOlympiadWorkspaceByExamId } from "@/lib/competitions";
import { safeReturnPath, withExamContext } from "@/lib/return-path";

export function legacyExamRedirect(request: Request, examId: string, kind: "subject" | "barem") {
  if (!/^olympiad:(5|6|7|8|9|10|11|12):/.test(examId)) {
    return new Response(null, { status: 404 });
  }
  const workspace = getOlympiadWorkspaceByExamId(examId);
  if (!workspace) return new Response(null, { status: 404 });

  const url = new URL(request.url);
  const rawReturnPath = url.searchParams.get("from");
  const path = `/exam/${encodeURIComponent(workspace.exam.id)}${kind === "barem" ? "/barem" : ""}`;
  const context = new URLSearchParams();
  if (rawReturnPath) context.set("from", safeReturnPath(rawReturnPath, "/"));
  for (const key of ["learningWorkspace", "learningActivity"]) {
    const value = url.searchParams.get(key);
    if (value && url.searchParams.getAll(key).length === 1) context.set(key, value);
  }
  const destination = new URL(withExamContext(path, context), url.origin);
  return new Response(null, {
    status: 308,
    headers: { location: destination.href, "cache-control": "private, no-store" },
  });
}
