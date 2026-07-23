import type { Exam } from "@/lib/schemas";

// Canonical choices follow the variants published in the Ministry's 2026
// official model packages. Historical names are mapped onto these choices.
export const subjectVariants: Partial<Record<Exam["subject"], readonly string[]>> = {
  romana: ["Real-Tehnologic", "Uman-Pedagogic"],
  matematica: ["Mate-Info", "Științele Naturii", "Tehnologic", "Pedagogic"],
  biologie: ["Anatomie și Fiziologie", "Vegetală și Animală"],
  chimie: ["Anorganică", "Organică"],
  fizica: ["Teoretic/Vocațional", "Tehnologic"],
  informatica: [
    "Mate-Info (MI), C/C++",
    "Mate-Info (MI), Pascal",
    "Științele Naturii (SN), C/C++",
    "Științele Naturii (SN), Pascal",
  ],
};

const profileMappings: Partial<Record<Exam["subject"], Record<string, readonly string[]>>> = {
  romana: {
    "Real-Tehnologic": ["Real-Tehnologic"],
    "real-tehnologic": ["Real-Tehnologic"],
    "Uman-Pedagogic": ["Uman-Pedagogic"],
    "uman-pedagogic": ["Uman-Pedagogic"],
  },
  matematica: {
    M1: ["Mate-Info"],
    "M_mate-info": ["Mate-Info"],
    "Mate-Info": ["Mate-Info"],
    M2: ["Științele Naturii", "Tehnologic"],
    "M_st-nat": ["Științele Naturii"],
    "Științele Naturii": ["Științele Naturii"],
    "M_tehnologic": ["Tehnologic"],
    Tehnologic: ["Tehnologic"],
    M4: ["Pedagogic"],
    "M_pedagogic": ["Pedagogic"],
    Pedagogic: ["Pedagogic"],
  },
  biologie: {
    "Anatomie și Fiziologie": ["Anatomie și Fiziologie"],
    "Vegetală și Animală": ["Vegetală și Animală"],
  },
  chimie: {
    Anorganică: ["Anorganică"],
    Organică: ["Organică"],
  },
  fizica: {
    "F_fizica_teoretic_vocational": ["Teoretic/Vocațional"],
    Teoretic: ["Teoretic/Vocațional"],
    Tehnologic: ["Tehnologic"],
    "Real · Tehnologic · Militar": ["Teoretic/Vocațional", "Tehnologic"],
    Comun: ["Teoretic/Vocațional", "Tehnologic"],
  },
  informatica: {
    "Mate-Info (MI), C/C++": ["Mate-Info (MI), C/C++"],
    "Mate-Info (MI), Pascal": ["Mate-Info (MI), Pascal"],
    "Științele Naturii (SN), C/C++": ["Științele Naturii (SN), C/C++"],
    "Științele Naturii (SN), Pascal": ["Științele Naturii (SN), Pascal"],
    "Mate-Info (MI)": ["Mate-Info (MI), C/C++", "Mate-Info (MI), Pascal"],
    "Științele Naturii (SN)": [
      "Științele Naturii (SN), C/C++",
      "Științele Naturii (SN), Pascal",
    ],
  },
};

export function getExamVariants(exam: Exam): readonly string[] {
  return profileMappings[exam.subject]?.[exam.profile] ?? [];
}
