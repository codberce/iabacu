import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public", "exams", "fizica");
const textRoot = path.join(root, "src", "data", "exam-text", "fizica");
const manifestPath = path.join(root, "src", "data", "exams-fizica.json");
const archiveApi = "https://api.arhivabac.com";
const archivePage = "https://www.arhivabac.com/subiecte-bac/fizica";

const sessionMetadata = {
  Model: ["model", "Model oficial"],
  Simulare: ["simulation", "Simulare nationala"],
  "Sesiunea specială": ["special", "Sesiunea speciala"],
  "Sesiunea iunie/iulie": ["final", "Sesiunea iunie-iulie"],
  "Sesiunea august/septembrie": ["autumn", "Sesiunea august"],
};
const sessionOrder = ["model", "simulation", "special", "final", "autumn"];

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "iabacu-importer/1.0" },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "iabacu-importer/1.0" },
  });
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function extractPdfText(pdfPath) {
  return execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
    .replace(/\u000c/g, "\n\n--- page ---\n\n")
    .trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isTheoretical(exam) {
  return exam.specialization?.tags?.includes("teoretic");
}

async function discoverExams() {
  const data = await fetchJson(`${archiveApi}/exams/examCategories/fizica`);
  const rows = [];

  for (const [yearText, sessions] of Object.entries(data.exams)) {
    const year = Number(yearText);
    if (year < 2013 || year > 2026) continue;

    for (const [sourceSession, exams] of Object.entries(sessions)) {
      const metadata = sessionMetadata[sourceSession];
      if (!metadata) continue;
      for (const exam of exams.filter(isTheoretical)) {
        rows.push({ ...exam, year, sessionType: metadata[0], sessionLabel: metadata[1] });
      }
    }
  }

  return rows.sort(
    (a, b) =>
      b.year - a.year ||
      sessionOrder.indexOf(a.sessionType) - sessionOrder.indexOf(b.sessionType),
  );
}

async function buildExam(sourceExam, order) {
  const detail = (await fetchJson(`${archiveApi}/exams/${sourceExam.examID}`)).exam;
  const subjectPdf = detail.pdfs.find((pdf) => pdf.pdfType === 0);
  const baremPdf = detail.pdfs.find((pdf) => pdf.pdfType === 1);
  if (!subjectPdf?.url || !baremPdf?.url) {
    throw new Error(`Missing PDF pair for archive exam ${sourceExam.examID}`);
  }

  const id = `fizica-${sourceExam.year}-${sourceExam.sessionType}`;
  const yearDir = path.join(publicRoot, String(sourceExam.year));
  const subjectPath = path.join(yearDir, `${id}-subiect.pdf`);
  const baremPath = path.join(yearDir, `${id}-barem.pdf`);
  const contextPath = path.join(textRoot, `${id}.json`);
  const [subjectBytes, baremBytes] = await Promise.all([
    fetchBuffer(subjectPdf.url),
    fetchBuffer(baremPdf.url),
  ]);

  await mkdir(yearDir, { recursive: true });
  await Promise.all([
    writeFile(subjectPath, subjectBytes),
    writeFile(baremPath, baremBytes),
  ]);
  await mkdir(textRoot, { recursive: true });
  await writeFile(
    contextPath,
    `${JSON.stringify(
      {
        examId: id,
        subjectText: extractPdfText(subjectPath),
        baremText: extractPdfText(baremPath),
      },
      null,
      2,
    )}\n`,
  );

  const sourcePage = `${archivePage}/${sourceExam.examID}-${sourceExam.slug}`;
  return {
    id,
    subject: "fizica",
    year: sourceExam.year,
    order,
    profile: "F_fizica_teoretic_vocational",
    language: "LRO",
    sessionType: sourceExam.sessionType,
    sessionLabel: sourceExam.sessionLabel,
    dateLabel: String(sourceExam.year),
    title: `${sourceExam.sessionLabel} ${sourceExam.year}`,
    examPdfPath: `/exams/fizica/${sourceExam.year}/${id}-subiect.pdf`,
    baremPdfPath: `/exams/fizica/${sourceExam.year}/${id}-barem.pdf`,
    contextPath: `src/data/exam-text/fizica/${id}.json`,
    sourceKind: "vetted-mirror",
    sourceUrl: sourcePage,
    baremSourceUrl: sourcePage,
    sha256: {
      exam: sha256(subjectBytes),
      barem: sha256(baremBytes),
    },
  };
}

async function main() {
  await rm(publicRoot, { recursive: true, force: true });
  await rm(textRoot, { recursive: true, force: true });

  const sources = await discoverExams();
  const exams = [];
  for (let index = 0; index < sources.length; index += 1) {
    const exam = await buildExam(sources[index], index);
    exams.push(exam);
    console.log(`Imported ${exam.id}`);
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(exams, null, 2)}\n`);
  console.log(`Wrote ${exams.length} exams to ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
