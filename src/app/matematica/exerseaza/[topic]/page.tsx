import { notFound } from "next/navigation";
import { practiceTopics, exercisesForTopic } from "@/lib/practice-topics";
import { createPageMetadata } from "@/lib/seo";
import { PracticeSet } from "@/components/practice-set";
export function generateStaticParams() { return practiceTopics.map((topic) => ({ topic: topic.id })); }
export default async function PracticeSetPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: id } = await params;
  const topic = practiceTopics.find((item) => item.id === id);
  if (!topic) notFound();
  return <PracticeSet topic={topic} exercises={exercisesForTopic(id)} />;
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: id } = await params;
  const topic = practiceTopics.find((item) => item.id === id);
  if (!topic) return {};
  return createPageMetadata({ title: `${topic.title} · Exerciții Bac Mate-Info`, description: "Trei exerciții din modelele oficiale, cu rezolvare scrisă și autoevaluare după barem.", path: `/matematica/exerseaza/${id}` });
}
