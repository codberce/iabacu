import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getOlympiadStage,
  olympiadArchivePath,
  olympiadStages,
  parseOlympiadGrade,
} from "@/lib/competitions";
import { createPageMetadata } from "@/lib/seo";

type StagePageProps = {
  params: Promise<{ stage: string }>;
  searchParams: Promise<{ clasa?: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return olympiadStages.map((stage) => ({ stage: stage.slug }));
}

export async function generateMetadata({
  params,
}: StagePageProps): Promise<Metadata> {
  const { stage: stageSlug } = await params;
  const stage = getOlympiadStage(stageSlug);
  if (!stage) notFound();

  return createPageMetadata({
    title: `Olimpiada de Matematică: etapa ${stage.name.toLocaleLowerCase("ro")}`,
    description: `Subiecte și bareme din etapa ${stage.name.toLocaleLowerCase("ro")}, organizate pe ani și clase.`,
    path: `/olimpiade/olimpiada-de-matematica/${stage.slug}`,
    keywords: [`olimpiada matematica ${stage.name.toLocaleLowerCase("ro")}`],
  });
}

export default async function OlympiadStagePage({
  params,
  searchParams,
}: StagePageProps) {
  const stage = getOlympiadStage((await params).stage);
  if (!stage) notFound();

  const grade = parseOlympiadGrade((await searchParams).clasa);
  redirect(olympiadArchivePath(grade, stage.slug));
}
