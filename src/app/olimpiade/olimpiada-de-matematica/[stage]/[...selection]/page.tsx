import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getOlympiadCountyBySlug,
  getOlympiadStage,
  getOlympiadWorkspaces,
  olympiadArchivePath,
  parseOlympiadGrade,
  type OlympiadStageSlug,
} from "@/lib/competitions";
import { createPageMetadata } from "@/lib/seo";

type ArchivePageProps = {
  params: Promise<{ stage: string; selection: string[] }>;
  searchParams: Promise<{ clasa?: string }>;
};

export const revalidate = 86400;

function resolveSelection(stage: OlympiadStageSlug, selection: string[]) {
  const year = Number(selection[0]);
  const county = selection[1] ? getOlympiadCountyBySlug(selection[1]) : undefined;
  if (
    !Number.isInteger(year) ||
    (stage === "locala" && (!county || selection.length !== 2)) ||
    (stage !== "locala" && selection.length !== 1)
  ) {
    return;
  }
  return { year, county };
}

export async function generateMetadata({
  params,
}: ArchivePageProps): Promise<Metadata> {
  const { stage: stageSlug, selection } = await params;
  const stage = getOlympiadStage(stageSlug);
  if (!stage) return {};
  const resolved = resolveSelection(stage.slug, selection);
  if (!resolved) return {};
  const label = resolved.county
    ? `${resolved.county} ${resolved.year}`
    : `${stage.name} ${resolved.year}`;
  return createPageMetadata({
    title: `Olimpiada de Matematică: ${label}`,
    description: `Subiectul și baremul pentru Olimpiada de Matematică, ${label}.`,
    path: `/olimpiade/olimpiada-de-matematica/${stage.slug}/${selection.join("/")}`,
  });
}

export default async function OlympiadArchivePage({
  params,
  searchParams,
}: ArchivePageProps) {
  const { stage: stageSlug, selection } = await params;
  const stage = getOlympiadStage(stageSlug);
  if (!stage) notFound();

  const grade = parseOlympiadGrade((await searchParams).clasa);
  if (!grade) {
    redirect(
      `/olimpiade/olimpiada-de-matematica?etapa=${stage.slug}`,
    );
  }

  const resolved = resolveSelection(stage.slug, selection);
  if (!resolved) notFound();
  const workspace = getOlympiadWorkspaces({
    stage: stage.slug,
    grade,
    ...resolved,
  })[0];
  if (!workspace) redirect(olympiadArchivePath(grade, stage.slug));

  redirect(`/exam/${workspace.exam.id}`);
}
