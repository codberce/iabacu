import type { Metadata } from "next";
import { ExamGrid, type ExamGridSearchParams } from "@/components/exam-grid";
import { nationalEvaluationExamsBySubject } from "@/lib/exams";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({ title: "Matematică · Evaluarea Națională", description: "Subiecte și bareme la Matematică pentru Evaluarea Națională.", path: "/evaluare-nationala/matematica", keywords: ["evaluare nationala matematica", "subiecte matematica clasa a 8-a"] });
const navItems = [
  { id: "romana", label: "Română", href: "/evaluare-nationala/romana", accent: "border-rose-300 bg-rose-50 text-rose-950" },
  { id: "matematica", label: "Matematică", href: "/evaluare-nationala/matematica", accent: "border-emerald-300 bg-emerald-50 text-emerald-950" },
];
export default async function Page({ searchParams }: { searchParams: Promise<ExamGridSearchParams> }) {
  return <ExamGrid exams={nationalEvaluationExamsBySubject.matematica ?? []} subject="matematica" title="Matematică" homeHref="/evaluare-nationala" homeLabel="Evaluarea Națională" archiveHref="/evaluare-nationala/matematica" navItems={navItems} currentNavId="matematica" initialSearchParams={await searchParams} showProfilePicker={false} />;
}
