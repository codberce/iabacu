import rawNationalEvaluationMathematics from "@/data/exams-evaluare-nationala-matematica.json";
import rawNationalEvaluationRomanian from "@/data/exams-evaluare-nationala-romana.json";
import rawMathematicsExams from "@/data/exams.json";
import rawPhysicsExams from "@/data/exams-fizica.json";
import rawInformaticsExams from "@/data/exams-informatica.json";
import rawRomanianExams from "@/data/exams-romana.json";
import archiveRomanian from "@/data/archive-romana.json";
import archiveMathematics from "@/data/archive-matematica.json";
import archiveHistory from "@/data/archive-istorie.json";
import archiveBiology from "@/data/archive-biologie.json";
import archiveChemistry from "@/data/archive-chimie.json";
import archivePhysics from "@/data/archive-fizica.json";
import archiveGeography from "@/data/archive-geografie.json";
import archiveInformatics from "@/data/archive-informatica.json";
import archiveLogic from "@/data/archive-logica.json";
import archivePsychology from "@/data/archive-psihologie.json";
import archiveSociology from "@/data/archive-sociologie.json";
import archiveEconomics from "@/data/archive-economie.json";
import archivePhilosophy from "@/data/archive-filosofie.json";
import { olympiadExams } from "@/lib/competitions";
import { resolveBacPdfPath } from "@/lib/bac-pdf-url";
import { examSchema, type Exam } from "@/lib/schemas";
import { z } from "zod";

const parseExams = (rawExams: unknown) =>
  z
    .array(examSchema)
    .parse(rawExams)
    .map((exam) => ({
      ...exam,
      examPdfPath: resolveBacPdfPath(exam.examPdfPath),
      baremPdfPath: resolveBacPdfPath(exam.baremPdfPath),
    }))
    .toSorted((a, b) => a.order - b.order);

export const mathematicsExams: Exam[] = parseExams(rawMathematicsExams);
export const romanianExams: Exam[] = parseExams(rawRomanianExams);
export const physicsExams: Exam[] = parseExams(rawPhysicsExams);
export const informaticsExams: Exam[] = parseExams(rawInformaticsExams);
function localArchivePdfPath(pdfPath: string): string {
  const match = pdfPath.match(
    /^\/api\/archive-pdf\/(\d+)\/(subject|barem)(?:\.pdf)?$/,
  );
  return match ? `/archive/${match[1]}-${match[2]}.pdf` : pdfPath;
}

export const archiveExams: Exam[] = parseExams([
  ...archiveRomanian, ...archiveMathematics, ...archiveHistory, ...archiveBiology,
  ...archiveChemistry, ...archivePhysics, ...archiveGeography, ...archiveInformatics,
  ...archiveLogic, ...archivePsychology, ...archiveSociology, ...archiveEconomics,
  ...archivePhilosophy,
].map((exam) => ({
  ...exam,
  examPdfPath: localArchivePdfPath(exam.examPdfPath),
  baremPdfPath: localArchivePdfPath(exam.baremPdfPath),
})));

const verifiedDuplicateAliases: Record<string, string> = {
  "archive-logica-872": "archive-logica-143",
  "archive-logica-871": "archive-logica-142",
  "archive-logica-870": "archive-logica-141",
  "archive-logica-869": "archive-logica-140",
  "archive-logica-868": "archive-logica-139",
  "archive-logica-867": "archive-logica-138",
  "archive-logica-865": "archive-logica-137",
  "archive-logica-864": "archive-logica-135",
  "archive-logica-866": "archive-logica-136",
};

const rawBacExams: Exam[] = [
  ...mathematicsExams,
  ...romanianExams,
  ...physicsExams,
  ...informaticsExams,
  ...archiveExams,
];

export const examAliases: Readonly<Record<string, string>> = {
  ...verifiedDuplicateAliases,
};

export function getCanonicalExamId(examId: string): string {
  return examAliases[examId] ?? examId;
}

export const bacExams: Exam[] = rawBacExams.filter(
  (exam) => getCanonicalExamId(exam.id) === exam.id,
);

export const examsBySubject = Object.groupBy(
  bacExams,
  (exam) => exam.subject,
);

export const bacYears = Array.from(new Set(bacExams.map((exam) => exam.year)))
  .toSorted((a, b) => b - a);

export const nationalEvaluationExams: Exam[] = parseExams([
  ...rawNationalEvaluationRomanian,
  ...rawNationalEvaluationMathematics,
]);
export const nationalEvaluationExamsBySubject = Object.groupBy(
  nationalEvaluationExams,
  (exam) => exam.subject,
);
export const nationalEvaluationYears = Array.from(
  new Set(nationalEvaluationExams.map((exam) => exam.year)),
).toSorted((a, b) => b - a);

export const exams: Exam[] = [
  ...bacExams,
  ...nationalEvaluationExams,
  ...olympiadExams,
];

export function getExamById(examId: string): Exam | undefined {
  const canonicalId = getCanonicalExamId(examId);
  return exams.find((exam) => exam.id === canonicalId);
}

export function groupExamsByYear(list: Exam[] = exams): Array<{
  year: number;
  exams: Exam[];
}> {
  const years = new Map<number, Exam[]>();
  for (const exam of list) {
    years.set(exam.year, [...(years.get(exam.year) ?? []), exam]);
  }

  return [...years.entries()]
    .map(([year, yearExams]) => ({
      year,
      exams: yearExams.toSorted((a, b) => a.order - b.order),
    }))
    .toSorted((a, b) => b.year - a.year);
}
