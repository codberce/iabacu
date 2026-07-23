import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getOlympiadWorkspace,
  parseOlympiadGrade,
} from "@/lib/competitions";
import { createPageMetadata } from "@/lib/seo";

type DocumentPageProps = {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ clasa?: string }>;
};

export const revalidate = 86400;

export async function generateMetadata({
  params,
  searchParams,
}: DocumentPageProps): Promise<Metadata> {
  const grade = parseOlympiadGrade((await searchParams).clasa);
  if (!grade) return {};
  const workspace = getOlympiadWorkspace((await params).documentId, grade);
  if (!workspace) return {};
  return createPageMetadata({
    title: workspace.exam.title,
    description: `${workspace.exam.sessionLabel}, cu subiect PDF, barem și spațiu de corectare.`,
    path: `/exam/${workspace.exam.id}`,
  });
}

export default async function OlympiadDocumentPage({
  params,
  searchParams,
}: DocumentPageProps) {
  const grade = parseOlympiadGrade((await searchParams).clasa);
  if (!grade) redirect("/olimpiade/olimpiada-de-matematica");

  const workspace = getOlympiadWorkspace((await params).documentId, grade);
  if (!workspace) notFound();
  redirect(`/exam/${workspace.exam.id}`);
}
