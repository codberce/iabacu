"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { RouteLoading } from "@/components/route-loading";
import { safeReturnPath, withReturnPath } from "@/lib/return-path";
import type { Exam } from "@/lib/schemas";

const ExamWorkspace = dynamic(
  () => import("@/components/exam-workspace").then((mod) => mod.ExamWorkspace),
  { loading: () => <RouteLoading label="Se încarcă spațiul de lucru" /> },
);

const BaremWorkspace = dynamic(
  () => import("@/components/barem-workspace").then((mod) => mod.BaremWorkspace),
  { loading: () => <RouteLoading label="Se încarcă spațiul de lucru" /> },
);

type Props = { exam: Exam; collectionPath: string };

// Navigation context belongs to the browser, so it never varies cached exam HTML.
export function ExamRouteWorkspace({ exam, collectionPath }: Props) {
  const query = useSearchParams();
  const returnPath = safeReturnPath(query.get("from") ?? undefined, collectionPath);

  return (
    <ExamWorkspace
      exam={exam}
      backHref={returnPath}
      baremHref={withReturnPath(`/exam/${exam.id}/barem`, returnPath)}
    />
  );
}

export function BaremRouteWorkspace({ exam, collectionPath }: Props) {
  const query = useSearchParams();
  const returnPath = safeReturnPath(query.get("from") ?? undefined, collectionPath);

  return (
    <BaremWorkspace
      exam={exam}
      backHref={returnPath}
      subjectHref={withReturnPath(`/exam/${exam.id}`, returnPath)}
    />
  );
}
