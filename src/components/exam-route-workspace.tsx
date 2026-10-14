"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { RouteLoading } from "@/components/route-loading";
import { safeReturnPath, withExamContext } from "@/lib/return-path";
import type { Exam } from "@/lib/schemas";

const ExamWorkspace = dynamic(
  () => import("@/components/exam-workspace").then((mod) => mod.ExamWorkspace),
  { ssr: false, loading: () => <RouteLoading label="Se încarcă spațiul de lucru" /> },
);

const BaremWorkspace = dynamic(
  () => import("@/components/barem-workspace").then((mod) => mod.BaremWorkspace),
  { ssr: false, loading: () => <RouteLoading label="Se încarcă spațiul de lucru" /> },
);

type Props = { exam: Exam; collectionPath: string };

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function useExamContext() {
  const query = useSearchParams();
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  // Keep old in-app links usable while the server redirects bookmarked queries.
  return hash ? new URLSearchParams(hash.slice(1)) : query;
}

function documentLink(path: string, query: Pick<URLSearchParams, "toString">, returnPath: string) {
  const context = new URLSearchParams(query.toString());
  context.set("from", returnPath);
  return withExamContext(path, context);
}

// Navigation context belongs to the browser, so it never varies cached exam HTML.
export function ExamRouteWorkspace({ exam, collectionPath }: Props) {
  const query = useExamContext();
  const returnPath = safeReturnPath(query.get("from") ?? undefined, collectionPath);

  return (
    <ExamWorkspace
      exam={exam}
      backHref={returnPath}
      baremHref={documentLink(`/exam/${exam.id}/barem`, query, returnPath)}
    />
  );
}

export function BaremRouteWorkspace({ exam, collectionPath }: Props) {
  const query = useExamContext();
  const returnPath = safeReturnPath(query.get("from") ?? undefined, collectionPath);

  return (
    <BaremWorkspace
      exam={exam}
      backHref={returnPath}
      subjectHref={documentLink(`/exam/${exam.id}`, query, returnPath)}
    />
  );
}
