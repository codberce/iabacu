import rawOlympiadIndex from "@/data/olympiad-index.json";
import rawOlympiadSubjectIndex from "@/data/olympiad-subject-index.json";
import rawOlympiadPlatformIndex from "@/data/olympiad-platform-index.json";
import { olympiadPdfUrl, olympiadTextUrl } from "@/lib/olympiad-assets";
import { archiveSearchIncludes } from "@/lib/archive-search";
import {
  getOlympiadSubject,
  olympiadSubjects,
  type OlympiadSubjectId,
} from "@/lib/olympiad-subjects";
import type { Exam } from "@/lib/schemas";

export const olympiadStages = [
  {
    slug: "locala",
    name: "Locală",
    description: "Subiecte organizate pe ani și județe",
  },
  {
    slug: "judeteana",
    name: "Județeană",
    description: "Etapa județeană, organizată pe ani",
  },
  {
    slug: "nationala",
    name: "Națională",
    description: "Etapa națională, organizată pe ani",
  },
] as const;

export type OlympiadStageSlug = (typeof olympiadStages)[number]["slug"];
export const olympiadGrades = [5, 6, 7, 8, 9, 10, 11, 12] as const;
export type OlympiadGrade = (typeof olympiadGrades)[number];

export type OlympiadDocument = {
  id: string;
  olympiadSubject: OlympiadSubjectId;
  stage: OlympiadStageSlug;
  year: number;
  county?: string;
  grade?: number;
  kind: "subject" | "solution" | "combined";
  title: string;
  pdfPath: string;
  textPath?: string;
  sourceUrl: string;
  sha256: string;
  size: number;
  pairKey?: string;
  language?: string;
};

export type OlympiadWorkspace = {
  exam: Exam;
  olympiadSubject: OlympiadSubjectId;
  selectedDocument: OlympiadDocument;
  subjectDocument: OlympiadDocument;
  solutionDocument: OlympiadDocument;
  stage: OlympiadStageSlug;
  grade: OlympiadGrade;
  year: number;
  county?: string;
};

type OlympiadDocumentTuple = [
  id: string,
  stage: OlympiadStageSlug,
  year: number,
  county: string | null,
  grade: number | null,
  kind: OlympiadDocument["kind"],
  title: string,
  sourceUrl: string,
  sha256: string,
  size: number,
  legacyPdfPath: string | null,
];
type ImportedOlympiadDocument = {
  id: string;
  olympiadSubject: OlympiadSubjectId;
  stage: OlympiadStageSlug;
  year: number;
  county?: string | null;
  grade?: number | null;
  kind: OlympiadDocument["kind"];
  title: string;
  sourceUrl: string;
  sha256: string;
  size: number;
  pairKey?: string | null;
  language?: string | null;
  legacyPdfPath?: string | null;
};

type PlatformOlympiadExam = {
  id: string;
  olympiadSubject: OlympiadSubjectId;
  stage: OlympiadStageSlug;
  year: number;
  grade: OlympiadGrade;
  title: string;
  platformUrl: string;
  provider: "kilonova" | "mlcompete" | "cyberedu";
  order?: number;
};

const mathematicsAssetBaseUrl = (
  rawOlympiadIndex as { assetBaseUrl?: string | null }
).assetBaseUrl ?? undefined;
const subjectAssetBaseUrl = (
  rawOlympiadSubjectIndex as { assetBaseUrl?: string | null }
).assetBaseUrl ?? mathematicsAssetBaseUrl;

const mathematicsDocuments = (
  rawOlympiadIndex.documents as OlympiadDocumentTuple[]
).map(
  ([
    id,
    stage,
    year,
    county,
    grade,
    kind,
    title,
    sourceUrl,
    sha256,
    size,
    legacyPdfPath,
  ]): OlympiadDocument => ({
    id,
    olympiadSubject: "matematica",
    stage,
    year,
    ...(county ? { county } : {}),
    ...(grade ? { grade } : {}),
    kind,
    title,
    pdfPath: olympiadPdfUrl(
      sha256,
      legacyPdfPath ?? undefined,
      mathematicsAssetBaseUrl,
    ),
    ...(mathematicsAssetBaseUrl
      ? {
          textPath: olympiadTextUrl(sha256, mathematicsAssetBaseUrl),
        }
      : {}),
    sourceUrl,
    sha256,
    size,
  }),
);

const subjectDocuments = (
  rawOlympiadSubjectIndex.documents as ImportedOlympiadDocument[]
).filter((document) => document.olympiadSubject !== "matematica").map(
  (document): OlympiadDocument => ({
    id: document.id,
    olympiadSubject: document.olympiadSubject,
    stage: document.stage,
    year: document.year,
    ...(document.county ? { county: document.county } : {}),
    ...(document.grade ? { grade: document.grade } : {}),
    kind: document.kind,
    title: document.title,
    pdfPath: olympiadPdfUrl(
      document.sha256,
      document.legacyPdfPath ?? undefined,
      subjectAssetBaseUrl,
    ),
    ...(subjectAssetBaseUrl
      ? { textPath: olympiadTextUrl(document.sha256, subjectAssetBaseUrl) }
      : {}),
    sourceUrl: document.sourceUrl,
    sha256: document.sha256,
    size: document.size,
    ...(document.pairKey ? { pairKey: document.pairKey } : {}),
    ...(document.language ? { language: document.language } : {}),
  }),
);

export const olympiadDocuments = [
  ...mathematicsDocuments,
  ...subjectDocuments,
];
export const olympiadArchiveGeneratedAt =
  (rawOlympiadSubjectIndex as { generatedAt?: string | null }).generatedAt ??
  rawOlympiadIndex.generatedAt;

const romanianCounties = [
  "Alba",
  "Arad",
  "Argeș",
  "Bacău",
  "Bihor",
  "Bistrița-Năsăud",
  "Botoșani",
  "Brașov",
  "Brăila",
  "București",
  "Buzău",
  "Caraș-Severin",
  "Călărași",
  "Cluj",
  "Constanța",
  "Covasna",
  "Dâmbovița",
  "Dolj",
  "Galați",
  "Giurgiu",
  "Gorj",
  "Harghita",
  "Hunedoara",
  "Ialomița",
  "Iași",
  "Ilfov",
  "Maramureș",
  "Mehedinți",
  "Mureș",
  "Neamț",
  "Olt",
  "Prahova",
  "Satu Mare",
  "Sălaj",
  "Sibiu",
  "Suceava",
  "Teleorman",
  "Timiș",
  "Tulcea",
  "Vaslui",
  "Vâlcea",
  "Vrancea",
] as const;

const romanianCollator = new Intl.Collator("ro");

export const olympiadCounties = romanianCounties.toSorted((a, b) =>
  romanianCollator.compare(a, b),
);

const stageSessionTypes: Record<OlympiadStageSlug, Exam["sessionType"]> = {
  locala: "model",
  judeteana: "simulation",
  nationala: "final",
};

export const olympiadSessionLabels: Partial<
  Record<Exam["sessionType"], string>
> = {
  model: "Locală",
  simulation: "Județeană",
  final: "Națională",
};

export function olympiadSessionTypeForStage(
  stage: OlympiadStageSlug,
): Exam["sessionType"] {
  return stageSessionTypes[stage];
}

export function getOlympiadStage(slug: string) {
  return olympiadStages.find((stage) => stage.slug === slug);
}

export function getOlympiadDocuments({
  olympiadSubject = "matematica",
  stage,
  year,
  county,
  grade,
}: {
  olympiadSubject?: OlympiadSubjectId;
  stage: OlympiadStageSlug;
  year: number;
  county?: string;
  grade?: OlympiadGrade;
}) {
  return olympiadDocuments.filter(
    (document) =>
      document.olympiadSubject === olympiadSubject &&
      document.stage === stage &&
      document.year === year &&
      (county == null || document.county === county) &&
      (grade == null || getOlympiadDocumentGrades(document).includes(grade)),
  );
}

export function parseOlympiadGrade(value?: string): OlympiadGrade | undefined {
  const grade = Number(value);
  return olympiadGrades.find((item) => item === grade);
}

export function getOlympiadDocumentGrades(
  document: OlympiadDocument,
): OlympiadGrade[] {
  const title = normalizeDocumentText(document.title);
  const romanGrade: Record<string, OlympiadGrade> = {
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
    xi: 11,
    xii: 12,
  };
  const range = title.match(
    /(?:clasa|clasele|cls|cl)?\s*(0?[5-9]|1[0-2]|xii|viii|vii|vi|xi|ix|v|x)\s*[-–_]\s*(0?[5-9]|1[0-2]|xii|viii|vii|vi|xi|ix|v|x)(?=[^a-z0-9]|$)/,
  );
  if (range) {
    const value = (item: string) =>
      (/^\d+$/.test(item) ? Number(item) : romanGrade[item]) as OlympiadGrade;
    const start = value(range[1]);
    const end = value(range[2]);
    if (start && end && start <= end) {
      return olympiadGrades.filter((grade) => grade >= start && grade <= end);
    }
  }
  if (document.grade) {
    return olympiadGrades.filter((grade) => grade === document.grade);
  }

  if (
    /(?:5|v)\s*[-–]\s*(?:12|xii)|(?:9|ix)\s*[-–]\s*(?:12|xii)|(?:5|v)\s*(?:la|pana la)\s*(?:12|xii)|gimnaziu\s*(?:si|\+|-)\s*liceu|toate clasele/.test(
      title,
    )
  ) {
    return [...olympiadGrades];
  }

  if (/gimnaziu/.test(title) && !/liceu/.test(title)) {
    return olympiadGrades.filter((grade) => grade <= 8);
  }
  if (/liceu/.test(title) && !/gimnaziu/.test(title)) {
    return olympiadGrades.filter((grade) => grade >= 9);
  }

  const numericGrades = [
    ...title.matchAll(
      /(?:^|[^0-9])(0?[5-9]|1[0-2])(?=(?:sb|sub|bar|barem)|[^0-9]|$)/g,
    ),
  ].map((match) => Number(match[1]) as OlympiadGrade);
  const romanGrades = [
    ...title.matchAll(/(?:^|[^a-z0-9])(xii|viii|vii|vi|xi|ix|v|x)(?=[^a-z0-9]|$)/g),
  ]
    .map(
      (match) =>
        ({ v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 })[
          match[1]
        ],
    )
    .filter((grade): grade is OlympiadGrade => grade != null);
  const inferredGrades = [...new Set([...numericGrades, ...romanGrades])];
  return inferredGrades.length > 0 ? inferredGrades : [...olympiadGrades];
}

export function getOlympiadDocument(documentId: string) {
  return olympiadDocuments.find((document) => document.id === documentId);
}

function normalizeDocumentText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro");
}

function documentPreference(document: OlympiadDocument, grade: OlympiadGrade) {
  const text = normalizeDocumentText(`${document.id} ${document.title}`);
  let score = document.grade === grade ? 100 : 0;
  if (document.language === "LRO") score += 20;
  if (/\b(?:ro|romana|romanesc)\b/.test(text)) score += 10;
  if (/\b(?:hu|maghiar)\b/.test(text)) score -= 20;
  return score;
}

function effectiveDocumentKind(document: OlympiadDocument) {
  if (document.kind !== "combined") return document.kind;

  const title = normalizeDocumentText(document.title);
  const mentionsSubject =
    /(?:^|[^a-z])(?:sb|sub|subiect|subiecte|enunt|enunturi)(?=[^a-z]|$)/.test(
      title,
    );
  const mentionsSolution =
    /(?:^|[^a-z])(?:bar|barem|bareme|sol|solutie|solutii|rezolvare|rezolvari|raspuns|raspunsuri)(?=[^a-z]|$)/.test(title);
  if (mentionsSubject && !mentionsSolution) return "subject";
  if (mentionsSolution && !mentionsSubject) return "solution";
  return "combined";
}

function olympiadVariantLabel(
  document: OlympiadDocument,
  grade: OlympiadGrade,
) {
  const text = normalizeDocumentText(document.title);
  const labels: string[] = [];

  const level = text.match(/(?:nivel(?:ul)?\s*)?\b([abc][12])(?:[ajg])?\b/);
  if (level) labels.push(`Nivel ${level[1].toLocaleUpperCase("ro")}`);

  const category = text.match(/\b(?:categoria|sectiunea)\s+([ab])\b/) ??
    text.match(new RegExp(`(?:clasa|cls|cl)?\\s*(?:a\\s*)?${grade}\\s+([ab])\\b`));
  if (category && !level) {
    labels.push(`Categoria ${category[1].toLocaleUpperCase("ro")}`);
  }

  if (/\bbilingv\b/.test(text)) labels.push("Bilingv");
  else if (/\bintensiv\b/.test(text)) labels.push("Intensiv");
  else if (/\bnormal\b/.test(text)) labels.push("Normal");

  if (/\b(?:proba\s+)?teoretic[ae]\b/.test(text)) labels.push("Proba teoretică");
  else if (/\b(?:proba\s+)?practic[ae]\b/.test(text)) labels.push("Proba practică");
  else if (/\b(?:proba\s+)?oral[ae]?\b/.test(text)) labels.push("Proba orală");
  else if (/\b(?:proba\s+)?scris[ae]?\b/.test(text)) labels.push("Proba scrisă");
  else if (/\bbaraj\b/.test(text)) labels.push("Baraj");

  const variant = text.match(/\b(?:varianta|var)\s*[-_.]?\s*(\d+)\b/);
  if (variant) labels.push(`Varianta ${variant[1]}`);

  if (!document.olympiadSubject.startsWith("limb")) {
    if (document.language === "hu" || /\blma\b/.test(text)) labels.push("în maghiară");
    else if (document.language === "de" || /\blge\b/.test(text)) labels.push("în germană");
  }

  return [...new Set(labels)].join(" · ") || undefined;
}

function pickDocument(
  documents: OlympiadDocument[],
  kinds: OlympiadDocument["kind"][],
  grade: OlympiadGrade,
) {
  for (const kind of kinds) {
    const candidates = documents
      .filter((document) => effectiveDocumentKind(document) === kind)
      .toSorted(
        (a, b) =>
          documentPreference(b, grade) - documentPreference(a, grade) ||
          a.id.localeCompare(b.id, "ro"),
      );
    if (candidates[0]) return candidates[0];
  }

  return undefined;
}

function createOlympiadWorkspace(
  documents: OlympiadDocument[],
  grade: OlympiadGrade,
): OlympiadWorkspace | undefined {
  const firstDocument = documents[0];
  if (!firstDocument) return;
  const subject = getOlympiadSubject(firstDocument.olympiadSubject);
  if (!subject) return;

  const combinedDocument = pickDocument(documents, ["combined"], grade);
  const subjectDocument =
    pickDocument(documents, ["subject"], grade) ?? combinedDocument;
  const solutionDocument =
    pickDocument(documents, ["solution"], grade) ?? combinedDocument;
  if (!subjectDocument || !solutionDocument) return;
  const examDocument = subjectDocument;
  const baremDocument = solutionDocument;

  const stage = getOlympiadStage(firstDocument.stage);
  if (!stage) return;

  const stageLabel = stage.name;
  const baseLocationLabel = firstDocument.county
    ? `${stageLabel} · ${firstDocument.county}`
    : stageLabel;
  const variantLabel = olympiadVariantLabel(examDocument, grade);
  const locationLabel = variantLabel
    ? `${baseLocationLabel} · ${variantLabel}`
    : baseLocationLabel;
  const stageOrder = olympiadStages.findIndex(
    (item) => item.slug === firstDocument.stage,
  );
  const countyOrder = firstDocument.county
    ? olympiadCounties.indexOf(
        firstDocument.county as (typeof olympiadCounties)[number],
      )
    : 0;

  const exam: Exam = {
    id:
      firstDocument.olympiadSubject === "matematica"
        ? `olimpiada-${grade}-${examDocument.id}`
        : `olimpiada-${firstDocument.olympiadSubject}-${grade}-${examDocument.id}`,
    category: "olympiad",
    subject: subject.examSubject,
    olympiadSubject: subject.id,
    year: firstDocument.year,
    order: stageOrder * 1000 + Math.max(0, countyOrder),
    profile: `${subject.olympiadName}, clasa a ${grade}-a`,
    language: "LRO",
    sessionType: stageSessionTypes[firstDocument.stage],
    sessionLabel: locationLabel,
    dateLabel: String(firstDocument.year),
    title: `${locationLabel} ${firstDocument.year}`,
    examPdfPath: examDocument.pdfPath,
    baremPdfPath: baremDocument.pdfPath,
    contextPath: "src/data/exam-text/olimpiada.json",
    sourceKind: "vetted-mirror",
    sourceUrl: examDocument.sourceUrl,
    baremSourceUrl: baremDocument.sourceUrl,
    sha256: {
      exam: examDocument.sha256,
      barem: baremDocument.sha256,
    },
  };

  return {
    exam,
    olympiadSubject: firstDocument.olympiadSubject,
    selectedDocument: examDocument,
    subjectDocument: examDocument,
    solutionDocument: baremDocument,
    stage: firstDocument.stage,
    grade,
    year: firstDocument.year,
    county: firstDocument.county,
  };
}

function buildOlympiadWorkspaces(
  olympiadSubject: OlympiadSubjectId,
  grade: OlympiadGrade,
) {
  const grouped = new Map<string, OlympiadDocument[]>();

  for (const document of olympiadDocuments) {
    if (document.olympiadSubject !== olympiadSubject) continue;
    if (!getOlympiadDocumentGrades(document).includes(grade)) continue;
    const key = [
      document.stage,
      document.year,
      document.county ?? "",
      grade,
      document.pairKey ?? "default",
    ].join(":");
    grouped.set(key, [...(grouped.get(key) ?? []), document]);
  }

  const workspaces = [...grouped.values()]
    .map((documents) => createOlympiadWorkspace(documents, grade))
    .filter((workspace): workspace is OlympiadWorkspace => workspace != null);
  const uniqueWorkspaces = [
    ...new Map(
      workspaces.map((workspace) => [[
        workspace.stage,
        workspace.year,
        workspace.county ?? "",
        workspace.grade,
        workspace.exam.sha256.exam,
        workspace.exam.sha256.barem,
      ].join(":"), workspace]),
    ).values(),
  ];
  const labels = Object.groupBy(
    uniqueWorkspaces,
    (workspace) => `${workspace.year}:${workspace.exam.sessionLabel}`,
  );
  for (const duplicates of Object.values(labels)) {
    if (!duplicates || duplicates.length < 2) continue;
    duplicates
      .toSorted((a, b) => a.exam.id.localeCompare(b.exam.id, "ro"))
      .forEach((workspace, index) => {
        workspace.exam.sessionLabel += ` · Varianta ${index + 1}`;
        workspace.exam.title = `${workspace.exam.sessionLabel} ${workspace.year}`;
      });
  }

  return uniqueWorkspaces.toSorted(
      (a, b) =>
        b.year - a.year ||
        a.exam.order - b.exam.order ||
        a.exam.sessionLabel.localeCompare(b.exam.sessionLabel, "ro"),
    );
}

export const documentOlympiadWorkspaces = olympiadSubjects
  .filter((subject) => subject.mode === "documents")
  .flatMap((subject) =>
    olympiadGrades.flatMap((grade) =>
      buildOlympiadWorkspaces(subject.id, grade),
    ),
  );

const platformOlympiadExams = (
  rawOlympiadPlatformIndex.exams as PlatformOlympiadExam[]
).flatMap((item): Exam[] => {
  const subject = getOlympiadSubject(item.olympiadSubject);
  const stage = getOlympiadStage(item.stage);
  if (!subject || subject.mode !== "platform" || !stage) return [];

  const platformUrl = item.platformUrl || subject.platformUrl;
  const taskLabel = item.title.split(/\s*·\s*/).at(-1)?.trim();
  const normalizedTaskLabel = normalizeDocumentText(taskLabel ?? "");
  const isRepeatedStage = normalizedTaskLabel === `etapa ${stage.slug}` ||
    normalizedTaskLabel === `etapa ${normalizeDocumentText(stage.name)}`;
  const sessionLabel = taskLabel && !isRepeatedStage
    ? `${stage.name} · ${taskLabel}`
    : stage.name;
  const emptyHash = "0".repeat(64);

  return [{
    id: item.id,
    category: "olympiad",
    subject: subject.examSubject,
    olympiadSubject: subject.id,
    year: item.year,
    order: item.order ?? 0,
    profile: `${subject.olympiadName}, clasa a ${item.grade}-a`,
    language: "LRO",
    sessionType: stageSessionTypes[item.stage],
    sessionLabel,
    dateLabel: String(item.year),
    title: `${sessionLabel} ${item.year}`,
    examPdfPath: platformUrl,
    baremPdfPath: platformUrl,
    contextPath: "src/data/exam-text/olimpiada.json",
    sourceKind: "vetted-mirror",
    sourceUrl: platformUrl,
    baremSourceUrl: platformUrl,
    sha256: { exam: emptyHash, barem: emptyHash },
    platform: { provider: item.provider, url: platformUrl },
  }];
});

export const olympiadWorkspaces = documentOlympiadWorkspaces;
export const olympiadExams = [
  ...documentOlympiadWorkspaces.map((workspace) => workspace.exam),
  ...platformOlympiadExams,
];

export const olympiadYears = Array.from(
  new Set(
    olympiadWorkspaces
      .filter((workspace) => workspace.olympiadSubject === "matematica")
      .map((workspace) => workspace.year),
  ),
).toSorted((a, b) => b - a);

export function getOlympiadWorkspaces({
  olympiadSubject = "matematica",
  grade,
  stage,
  year,
  county,
}: {
  olympiadSubject?: OlympiadSubjectId;
  grade: OlympiadGrade;
  stage?: OlympiadStageSlug;
  year?: number;
  county?: string;
}) {
  const matches = olympiadWorkspaces.filter(
    (workspace) =>
      workspace.olympiadSubject === olympiadSubject &&
      workspace.grade === grade &&
      (stage == null || workspace.stage === stage) &&
      (year == null || workspace.year === year) &&
      (county == null || workspace.county === county),
  );

  if (matches.length > 0 || county == null) return matches;

  // Some years publish one common local-stage paper instead of county-specific
  // files. Reuse a verified paper for the requested county so every county/year
  // route remains usable, while clearly marking the workspace as shared.
  const fallback = olympiadWorkspaces.find(
    (workspace) =>
      workspace.olympiadSubject === olympiadSubject &&
      workspace.grade === grade &&
      (stage == null || workspace.stage === stage) &&
      (year == null || workspace.year === year),
  );
  if (!fallback) return [];

  return [{
    ...fallback,
    county,
    exam: {
      ...fallback.exam,
      sessionLabel: `${fallback.exam.sessionLabel} · material comun pentru ${county}`,
      title: `${fallback.exam.title} · material comun pentru ${county}`,
    },
  }];
}

export function getOlympiadExams(filters: Parameters<typeof getOlympiadWorkspaces>[0]) {
  return getOlympiadWorkspaces(filters).map((workspace) => workspace.exam);
}

export function getOlympiadWorkspace(
  documentId: string,
  grade: OlympiadGrade,
) {
  const selectedDocument = getOlympiadDocument(documentId);
  if (
    !selectedDocument ||
    !getOlympiadDocumentGrades(selectedDocument).includes(grade)
  ) {
    return;
  }

  const workspace = getOlympiadWorkspaces({
    olympiadSubject: selectedDocument.olympiadSubject,
    stage: selectedDocument.stage,
    year: selectedDocument.year,
    county: selectedDocument.county,
    grade,
  }).find(
    (candidate) =>
      (candidate.selectedDocument.pairKey ?? "default") ===
      (selectedDocument.pairKey ?? "default"),
  );
  return workspace ? { ...workspace, selectedDocument } : undefined;
}

export function getOlympiadWorkspaceByExamId(examId: string) {
  const canonicalWorkspace = olympiadWorkspaces.find(
    (workspace) => workspace.exam.id === examId,
  );
  if (canonicalWorkspace) return canonicalWorkspace;

  const legacyMatch = examId.match(/^olympiad:(5|6|7|8|9|10|11|12):(.+)$/);
  if (!legacyMatch) return;
  return getOlympiadWorkspace(
    legacyMatch[2],
    Number(legacyMatch[1]) as OlympiadGrade,
  );
}

export function olympiadArchivePath(
  grade?: OlympiadGrade,
  stage?: OlympiadStageSlug,
) {
  const searchParams = new URLSearchParams();
  if (grade) searchParams.set("clasa", String(grade));
  if (stage) searchParams.set("etapa", stage);
  const query = searchParams.toString();
  return `/olimpiade/olimpiada-de-matematica${query ? `?${query}` : ""}`;
}

export function olympiadArchivePathForSubject(
  olympiadSubject: OlympiadSubjectId,
  grade?: OlympiadGrade,
  stage?: OlympiadStageSlug,
) {
  const subject = getOlympiadSubject(olympiadSubject);
  if (!subject) return "/olimpiade";
  const searchParams = new URLSearchParams();
  if (grade) searchParams.set("clasa", String(grade));
  if (stage) searchParams.set("etapa", stage);
  const query = searchParams.toString();
  return `${subject.path}${query ? `?${query}` : ""}`;
}

export function getOlympiadGradesForSubject(
  olympiadSubject: OlympiadSubjectId,
): OlympiadGrade[] {
  const grades = new Set<OlympiadGrade>();
  for (const exam of olympiadExams) {
    if (exam.olympiadSubject !== olympiadSubject) continue;
    const match = exam.profile.match(/clasa a (\d+)-a/i);
    const grade = parseOlympiadGrade(match?.[1]);
    if (grade) grades.add(grade);
  }
  if (grades.size > 0) return [...grades].toSorted((a, b) => a - b);
  const subject = getOlympiadSubject(olympiadSubject);
  return (subject?.grades ?? olympiadGrades).filter(
    (grade): grade is OlympiadGrade => olympiadGrades.includes(grade as OlympiadGrade),
  );
}

export function getOlympiadYearsForSubject(olympiadSubject: OlympiadSubjectId) {
  return Array.from(
    new Set(
      olympiadExams
        .filter((exam) => exam.olympiadSubject === olympiadSubject)
        .map((exam) => exam.year),
    ),
  ).toSorted((a, b) => b - a);
}

export function olympiadCountySlug(county: string) {
  return county
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getOlympiadCountyBySlug(slug: string) {
  return olympiadCounties.find((county) => olympiadCountySlug(county) === slug);
}

export const PLATFORM_ARCHIVE_PAGE_SIZE = 48;
export const PLATFORM_ARCHIVE_MAX_PAGE = 1000;

export type PlatformArchiveFilters = {
  olympiadSubject: OlympiadSubjectId;
  grade: OlympiadGrade;
  stage: OlympiadStageSlug | "all";
  year: number | "all";
  q: string;
  page: number;
};

export type PlatformArchivePage = {
  filters: PlatformArchiveFilters;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
  exams: Exam[];
  years: number[];
  stages: readonly OlympiadStageSlug[];
};

function parsePlatformStageFilter(value: string | undefined): OlympiadStageSlug | "all" {
  if (!value || value === "all") return "all";
  return getOlympiadStage(value)?.slug ?? "all";
}

function parsePlatformYearFilter(
  value: string | undefined,
  allowed: readonly number[],
): number | "all" {
  if (!value || value === "all") return "all";
  const parsed = Number(value);
  return Number.isInteger(parsed) && allowed.includes(parsed) ? parsed : "all";
}

function parsePlatformPageFilter(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, PLATFORM_ARCHIVE_MAX_PAGE);
}

export function getPlatformArchiveExams({
  olympiadSubject,
  grade,
  stage,
  year,
  q,
}: {
  olympiadSubject: OlympiadSubjectId;
  grade: OlympiadGrade;
  stage: OlympiadStageSlug | "all";
  year: number | "all";
  q: string;
}): Exam[] {
  const normalizedQuery = (q ?? "").trim();
  return olympiadExams
    .filter(
      (exam) =>
        exam.olympiadSubject === olympiadSubject &&
        exam.profile.endsWith(`clasa a ${grade}-a`) &&
        (stage === "all" || exam.sessionType === olympiadSessionTypeForStage(stage)) &&
        (year === "all" || exam.year === year),
    )
    .filter((exam) => {
      if (!normalizedQuery) return true;
      return archiveSearchIncludes(
        [exam.title, exam.sessionLabel, String(exam.year), exam.id].join(" "),
        normalizedQuery,
      );
    })
    .toSorted(
      (a, b) =>
        b.year - a.year ||
        a.order - b.order ||
        a.sessionLabel.localeCompare(b.sessionLabel, "ro"),
    );
}

export function getPlatformArchive({
  olympiadSubject,
  grade,
  stage: rawStage,
  year: rawYear,
  q: rawQuery,
  page: rawPage,
}: {
  olympiadSubject: OlympiadSubjectId;
  grade: OlympiadGrade;
  stage?: string;
  year?: string;
  q?: string;
  page?: string;
}): PlatformArchivePage {
  const allForGrade = olympiadExams.filter(
    (exam) =>
      exam.olympiadSubject === olympiadSubject &&
      exam.profile.endsWith(`clasa a ${grade}-a`),
  );
  const years = Array.from(new Set(allForGrade.map((exam) => exam.year))).toSorted(
    (a, b) => b - a,
  );
  const stages: readonly OlympiadStageSlug[] = ["locala", "judeteana", "nationala"];
  const stage = parsePlatformStageFilter(rawStage);
  const year = parsePlatformYearFilter(rawYear, years);
  const q = (rawQuery ?? "").trim();
  const filters: PlatformArchiveFilters = {
    olympiadSubject,
    grade,
    stage,
    year,
    q,
    page: 1,
  };
  const filtered = getPlatformArchiveExams({
    olympiadSubject,
    grade,
    stage,
    year,
    q,
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PLATFORM_ARCHIVE_PAGE_SIZE));
  const requestedPage = parsePlatformPageFilter(rawPage);
  const page = Math.min(requestedPage, totalPages);
  const startIndex = total === 0 ? 0 : (page - 1) * PLATFORM_ARCHIVE_PAGE_SIZE + 1;
  const endIndex = Math.min(total, page * PLATFORM_ARCHIVE_PAGE_SIZE);
  const exams = filtered.slice(
    (page - 1) * PLATFORM_ARCHIVE_PAGE_SIZE,
    page * PLATFORM_ARCHIVE_PAGE_SIZE,
  );
  return {
    filters: { ...filters, page },
    total,
    totalPages,
    page,
    pageSize: PLATFORM_ARCHIVE_PAGE_SIZE,
    startIndex,
    endIndex,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    exams,
    years,
    stages,
  };
}

export function platformArchivePath({
  olympiadSubject,
  grade,
  stage,
  year,
  q,
  page,
}: {
  olympiadSubject: OlympiadSubjectId;
  grade: OlympiadGrade;
  stage: OlympiadStageSlug | "all";
  year: number | "all";
  q: string;
  page: number;
}) {
  const subject = getOlympiadSubject(olympiadSubject);
  if (!subject) return "/olimpiade";
  const params = new URLSearchParams();
  params.set("clasa", String(grade));
  if (stage !== "all") params.set("etapa", stage);
  if (year !== "all") params.set("an", String(year));
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("pagina", String(page));
  return `${subject.path}?${params.toString()}`;
}
