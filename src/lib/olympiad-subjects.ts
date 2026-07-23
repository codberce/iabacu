export type OlympiadSubjectId =
  | "romana"
  | "matematica"
  | "fizica"
  | "chimie"
  | "biologie"
  | "astronomie-si-astrofizica"
  | "geografie"
  | "istorie"
  | "memoria-holocaustului"
  | "stiinte-socio-umane"
  | "limba-engleza"
  | "limba-franceza"
  | "limba-germana-moderna"
  | "limbi-romanice"
  | "lingvistica"
  | "stiinte-pentru-juniori"
  | "stiintele-pamantului"
  | "tehnologia-informatiei-si-comunicatiilor"
  | "informatica"
  | "inteligenta-artificiala"
  | "securitate-cibernetica";

type OlympiadSubjectBase = {
  id: OlympiadSubjectId;
  name: string;
  olympiadName: string;
  path: string;
  accent: string;
  grades: readonly number[];
  examSubject:
    | "romana"
    | "matematica"
    | "fizica"
    | "chimie"
    | "biologie"
    | "geografie"
    | "istorie"
    | "logica"
    | "informatica";
};

export type OlympiadSubject = OlympiadSubjectBase &
  (
    | { mode: "documents" }
    | {
        mode: "platform";
        platformName: "Kilonova" | "MLCompete" | "CyberEDU";
        platformUrl: string;
      }
  );

const defaultGrades = [5, 6, 7, 8, 9, 10, 11, 12] as const;

export const olympiadSubjects = [
  {
    id: "romana",
    name: "Limba și literatura română",
    olympiadName: "Olimpiada de Limba și literatura română",
    path: "/olimpiade/olimpiada-de-limba-si-literatura-romana",
    mode: "documents",
    accent: "border-rose-300 bg-rose-50 text-rose-950",
    grades: defaultGrades,
    examSubject: "romana",
  },
  {
    id: "matematica",
    name: "Matematică",
    olympiadName: "Olimpiada de Matematică",
    path: "/olimpiade/olimpiada-de-matematica",
    mode: "documents",
    accent: "border-emerald-300 bg-emerald-50 text-emerald-950",
    grades: defaultGrades,
    examSubject: "matematica",
  },
  {
    id: "fizica",
    name: "Fizică",
    olympiadName: "Olimpiada de Fizică",
    path: "/olimpiade/olimpiada-de-fizica",
    mode: "documents",
    accent: "border-amber-300 bg-amber-50 text-amber-950",
    grades: defaultGrades,
    examSubject: "fizica",
  },
  {
    id: "chimie",
    name: "Chimie",
    olympiadName: "Olimpiada de Chimie",
    path: "/olimpiade/olimpiada-de-chimie",
    mode: "documents",
    accent: "border-cyan-300 bg-cyan-50 text-cyan-950",
    grades: defaultGrades,
    examSubject: "chimie",
  },
  {
    id: "biologie",
    name: "Biologie",
    olympiadName: "Olimpiada de Biologie",
    path: "/olimpiade/olimpiada-de-biologie",
    mode: "documents",
    accent: "border-lime-300 bg-lime-50 text-lime-950",
    grades: defaultGrades,
    examSubject: "biologie",
  },
  {
    id: "astronomie-si-astrofizica",
    name: "Astronomie și astrofizică",
    olympiadName: "Olimpiada de Astronomie și astrofizică",
    path: "/olimpiade/olimpiada-de-astronomie-si-astrofizica",
    mode: "documents",
    accent: "border-indigo-300 bg-indigo-50 text-indigo-950",
    grades: defaultGrades,
    examSubject: "fizica",
  },
  {
    id: "geografie",
    name: "Geografie",
    olympiadName: "Olimpiada de Geografie",
    path: "/olimpiade/olimpiada-de-geografie",
    mode: "documents",
    accent: "border-teal-300 bg-teal-50 text-teal-950",
    grades: defaultGrades,
    examSubject: "geografie",
  },
  {
    id: "istorie",
    name: "Istorie",
    olympiadName: "Olimpiada de Istorie",
    path: "/olimpiade/olimpiada-de-istorie",
    mode: "documents",
    accent: "border-orange-300 bg-orange-50 text-orange-950",
    grades: defaultGrades,
    examSubject: "istorie",
  },
  {
    id: "memoria-holocaustului",
    name: "Memoria Holocaustului",
    olympiadName: "Memoria Holocaustului",
    path: "/olimpiade/concursul-national-memoria-holocaustului",
    mode: "documents",
    accent: "border-stone-300 bg-stone-50 text-stone-950",
    grades: [9, 10, 11, 12],
    examSubject: "istorie",
  },
  {
    id: "stiinte-socio-umane",
    name: "Științe socio-umane",
    olympiadName: "Olimpiada de Științe socio-umane",
    path: "/olimpiade/olimpiada-de-stiinte-socio-umane",
    mode: "documents",
    accent: "border-purple-300 bg-purple-50 text-purple-950",
    grades: defaultGrades,
    examSubject: "logica",
  },
  {
    id: "limba-engleza",
    name: "Limba engleză",
    olympiadName: "Olimpiada de Limba engleză",
    path: "/olimpiade/olimpiada-de-limba-engleza",
    mode: "documents",
    accent: "border-sky-300 bg-sky-50 text-sky-950",
    grades: defaultGrades,
    examSubject: "romana",
  },
  {
    id: "limba-franceza",
    name: "Limba franceză",
    olympiadName: "Olimpiada de Limba franceză",
    path: "/olimpiade/olimpiada-de-limba-franceza",
    mode: "documents",
    accent: "border-blue-300 bg-blue-50 text-blue-950",
    grades: defaultGrades,
    examSubject: "romana",
  },
  {
    id: "limba-germana-moderna",
    name: "Limba germană modernă",
    olympiadName: "Olimpiada de Limba germană modernă",
    path: "/olimpiade/olimpiada-de-limba-germana-moderna",
    mode: "documents",
    accent: "border-yellow-300 bg-yellow-50 text-yellow-950",
    grades: [7, 8, 9, 10, 11, 12],
    examSubject: "romana",
  },
  {
    id: "limbi-romanice",
    name: "Limbi romanice",
    olympiadName: "Olimpiada de Limbi romanice",
    path: "/olimpiade/olimpiada-de-limbi-romanice",
    mode: "documents",
    accent: "border-pink-300 bg-pink-50 text-pink-950",
    grades: defaultGrades,
    examSubject: "romana",
  },
  {
    id: "lingvistica",
    name: "Lingvistică",
    olympiadName: "Olimpiada de Lingvistică",
    path: "/olimpiade/olimpiada-de-lingvistica",
    mode: "documents",
    accent: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950",
    grades: defaultGrades,
    examSubject: "romana",
  },
  {
    id: "stiinte-pentru-juniori",
    name: "Științe pentru Juniori",
    olympiadName: "Olimpiada de Științe pentru Juniori",
    path: "/olimpiade/olimpiada-de-stiinte-pentru-juniori",
    mode: "documents",
    accent: "border-lime-300 bg-lime-50 text-lime-950",
    grades: defaultGrades,
    examSubject: "biologie",
  },
  {
    id: "stiintele-pamantului",
    name: "Științele Pământului",
    olympiadName: "Olimpiada de Științele Pământului",
    path: "/olimpiade/olimpiada-de-stiintele-pamantului",
    mode: "documents",
    accent: "border-emerald-300 bg-emerald-50 text-emerald-950",
    grades: defaultGrades,
    examSubject: "geografie",
  },
  {
    id: "tehnologia-informatiei-si-comunicatiilor",
    name: "Tehnologia informației și comunicațiilor",
    olympiadName: "Olimpiada de Tehnologia informației și comunicațiilor",
    path: "/olimpiade/olimpiada-de-tehnologia-informatiei-si-comunicatiilor",
    mode: "documents",
    accent: "border-cyan-300 bg-cyan-50 text-cyan-950",
    grades: defaultGrades,
    examSubject: "informatica",
  },
  {
    id: "informatica",
    name: "Informatică",
    olympiadName: "Olimpiada de Informatică",
    path: "/olimpiade/olimpiada-de-informatica",
    mode: "platform",
    platformName: "Kilonova",
    platformUrl: "https://kilonova.ro/",
    accent: "border-sky-300 bg-sky-50 text-sky-950",
    grades: defaultGrades,
    examSubject: "informatica",
  },
  {
    id: "inteligenta-artificiala",
    name: "Inteligență artificială",
    olympiadName: "Olimpiada de Inteligență artificială",
    path: "/olimpiade/olimpiada-de-inteligenta-artificiala",
    mode: "platform",
    platformName: "MLCompete",
    platformUrl: "https://platform.olimpiada-ai.ro/ro/competitions",
    accent: "border-violet-300 bg-violet-50 text-violet-950",
    grades: defaultGrades,
    examSubject: "informatica",
  },
  {
    id: "securitate-cibernetica",
    name: "Securitate cibernetică",
    olympiadName: "Olimpiada de Securitate cibernetică",
    path: "/olimpiade/olimpiada-de-securitate-cibernetica",
    mode: "platform",
    platformName: "CyberEDU",
    platformUrl: "https://cyber-edu.co/trainings",
    accent: "border-zinc-300 bg-zinc-50 text-zinc-950",
    grades: defaultGrades,
    examSubject: "informatica",
  },
] as const satisfies readonly OlympiadSubject[];

export function getOlympiadSubject(id: string) {
  return olympiadSubjects.find((subject) => subject.id === id);
}

export function getOlympiadSubjectByPathSegment(segment: string) {
  return olympiadSubjects.find(
    (subject) => subject.path.split("/").at(-1) === segment,
  );
}
