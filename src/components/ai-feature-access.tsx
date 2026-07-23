"use client";

import { KeyRound } from "lucide-react";

export function useAiFeatureAccess() {
  return {
    isLoading: false,
    isSignedIn: true,
    isLocked: false,
    userId: null,
  };
}

type AiAccessKind = "corrector" | "questions";

const accessCopy: Record<AiAccessKind, { title: string; description: string }> = {
  corrector: {
    title: "Corectare AI neconfigurată",
    description: "Adaugă cheia, URL-ul și modelul furnizorului AI în .env.local.",
  },
  questions: {
    title: "Asistent AI neconfigurat",
    description: "Adaugă cheia, URL-ul și modelul furnizorului AI în .env.local.",
  },
};

export function AiFeatureAccessCard({ kind }: { kind: AiAccessKind }) {
  const copy = accessCopy[kind];
  return (
    <section className="flex min-h-full flex-col justify-center bg-white px-5 py-8 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
        <KeyRound className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-xl font-semibold text-zinc-950">{copy.title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600">{copy.description}</p>
    </section>
  );
}

export function AiFeatureAccessSkeleton() {
  return null;
}
