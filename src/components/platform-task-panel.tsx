import { ExternalLink } from "lucide-react";
import type { Exam } from "@/lib/schemas";

const platformNames: Record<NonNullable<Exam["platform"]>["provider"], string> = {
  kilonova: "Kilonova",
  mlcompete: "MLCompete",
  cyberedu: "CyberEDU",
};

type PlatformTaskPanelProps = {
  platform: NonNullable<Exam["platform"]>;
  view: "subject" | "barem";
};

export function PlatformTaskPanel({ platform, view }: PlatformTaskPanelProps) {
  const name = platformNames[platform.provider];
  const isSubject = view === "subject";

  return (
    <div className="flex h-full min-h-[420px] items-center justify-center bg-[#f7f8f5] p-6 sm:p-10">
      <div className="w-full max-w-lg border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
          {isSubject ? `Rezolvă pe ${name}` : `Verifică rezultatul pe ${name}`}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600">
          {isSubject
            ? "Proba se rezolvă direct pe platforma sursă. După evaluare, revino aici și încarcă o captură cu rezultatul."
            : "Evaluarea și detaliile punctajului sunt disponibile direct pe platforma sursă."}
        </p>
        <a
          href={platform.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Deschide în {name}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
