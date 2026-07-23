import type { Metadata } from "next";
import type { Exam } from "@/lib/schemas";

function configuredSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  try {
    return new URL(value).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export const siteUrl = configuredSiteUrl();
export const siteName = "iabacu";
export const currentBacYear = 2026;
export const siteContentUpdatedAt = "2026-07-22";
export const defaultTitle = "iabacu – Subiecte și bareme de bacalaureat";
export const defaultDescription =
  "iabacu este arhiva de subiecte și bareme de bacalaureat, organizate simplu pe materii și ani. Lucrează direct pe PDF și verifică-ți rezolvarea.";
export const ogImagePath = "/opengraph-image";
const subjectPageDescription =
  "Subiecte și bareme de bacalaureat, de la modele și simulări la sesiunile oficiale. Organizate pe ani și variante.";

function subjectPageTitle(subjectName: string): string {
  return `Bac ${subjectName}: subiecte și bareme`;
}

export const baseKeywords = [
  "iabacu",
  "iabacu.ro",
  "subiecte bac",
  "bareme bac",
  "bacalaureat",
  "modele bac",
  "simulare bac",
  "arhiva bac",
  "corectare bac",
];

export const subjectSeo: Record<
  Exam["subject"],
  {
    name: string;
    shortName: string;
    path: string;
    title: string;
    description: string;
    keywords: string[];
  }
> = {
  romana: {
    name: "Limba și literatura română",
    shortName: "Română",
    path: "/romana",
    title: subjectPageTitle("Română"),
    description: subjectPageDescription,
    keywords: [
      "subiecte bac romana",
      "barem bac romana",
      "limba romana bac",
    ],
  },
  matematica: {
    name: "Matematică",
    shortName: "Matematică",
    path: "/matematica",
    title: subjectPageTitle("Matematică"),
    description: subjectPageDescription,
    keywords: [
      "subiecte bac matematica",
      "barem bac matematica",
      "mate info bac",
    ],
  },
  fizica: {
    name: "Fizică",
    shortName: "Fizică",
    path: "/fizica",
    title: subjectPageTitle("Fizică"),
    description: subjectPageDescription,
    keywords: ["subiecte bac fizica", "barem bac fizica", "fizica bac"],
  },
  informatica: {
    name: "Informatică",
    shortName: "Informatică",
    path: "/informatica",
    title: subjectPageTitle("Informatică"),
    description: subjectPageDescription,
    keywords: [
      "subiecte bac informatica",
      "barem bac informatica",
      "informatica bac",
    ],
  },
  istorie: seoSubject("Istorie", "istorie"),
  biologie: seoSubject("Biologie", "biologie"),
  chimie: seoSubject("Chimie", "chimie"),
  geografie: seoSubject("Geografie", "geografie"),
  logica: seoSubject("Logică, argumentare și comunicare", "logica", "Logică"),
  psihologie: seoSubject("Psihologie", "psihologie"),
  sociologie: seoSubject("Sociologie", "sociologie"),
  economie: seoSubject("Economie", "economie"),
  filosofie: seoSubject("Filosofie", "filosofie"),
};

function seoSubject(name: string, slug: string, titleName = name) {
  return {
    name,
    shortName: titleName,
    path: `/${slug}`,
    title: subjectPageTitle(titleName),
    description: subjectPageDescription,
    keywords: [`subiecte bac ${slug}`, `barem bac ${slug}`],
  };
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

export function createPageMetadata({
  title,
  description,
  path,
  keywords = [],
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  return {
    title,
    description,
    keywords: [...baseKeywords, ...keywords],
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName,
      locale: "ro_RO",
      type: "website",
      images: [
        {
          url: ogImagePath,
          width: 1200,
          height: 630,
          alt: `${siteName} - ${title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImagePath],
    },
  };
}

export function examPagePath(exam: Exam): string {
  return `/exam/${exam.id}`;
}

export function baremPagePath(exam: Exam): string {
  return `/exam/${exam.id}/barem`;
}

export function examDescription(exam: Exam): string {
  return `Subiectul de bacalaureat la ${subjectSeo[exam.subject].name} din ${exam.year}, ${exam.sessionLabel}, profil ${exam.profile}. Deschide PDF-ul și baremul.`;
}

export function baremDescription(exam: Exam): string {
  return `Baremul de bacalaureat la ${subjectSeo[exam.subject].name} din ${exam.year}, ${exam.sessionLabel}, profil ${exam.profile}. Deschide PDF-ul și verifică rezolvarea.`;
}

const shortSessionNames: Record<Exam["sessionType"], string> = {
  model: "model oficial",
  simulation: "simulare",
  special: "sesiunea specială",
  final: "sesiunea de vară",
  reserve: "rezervă",
  autumn: "sesiunea de toamnă",
};

const shortProfileNames: Record<string, string> = {
  Comun: "",
  General: "",
  M_mate_info: "M1",
  "M_mate-info": "M1",
  "Mate-Info": "M1",
  "Mate-Info (MI)": "M1",
  "Mate-Info (MI), C/C++": "M1 C/C++",
  "Mate-Info (MI), Pascal": "M1 Pascal",
  "Științele Naturii (SN)": "Științele naturii",
  "Științele Naturii (SN), C/C++": "Științele naturii C/C++",
  "Științele Naturii (SN), Pascal": "Științele naturii Pascal",
  F_fizica_teoretic_vocational: "Fizică teoretic/vocațional",
};

export function bacExamTitle(exam: Exam, kind: "subject" | "barem"): string {
  const subject = subjectSeo[exam.subject].shortName;
  const documentLabel = kind === "subject" ? "Subiect bac" : "Barem bac";
  const profileName = shortProfileNames[exam.profile] ?? exam.profile;
  const profile = profileName ? ` (${profileName})` : "";
  return `${documentLabel} ${subject} ${exam.year} – ${shortSessionNames[exam.sessionType]}${profile}`;
}

export function olympiadExamTitle(
  exam: Exam,
  grade: number,
  kind: "subject" | "barem",
): string {
  const documentLabel = kind === "subject" ? "Subiect" : "Barem";
  const olympiadName = exam.profile.split(", clasa a ")[0] || "Olimpiadă";
  return `${documentLabel} ${olympiadName} ${exam.year} – clasa a ${grade}-a, ${exam.sessionLabel}`;
}
