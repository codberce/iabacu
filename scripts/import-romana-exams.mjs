import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public", "exams", "romana");
const textRoot = path.join(root, "src", "data", "exam-text", "romana");
const manifestPath = path.join(root, "src", "data", "exams-romana.json");
const tmpRoot = path.join(root, ".tmp-romana-exam-import");

const HEI_PROFU_URL =
  "https://heiprofu.ro/alte-materii/limba-romana/subiecte-variante-bac-limba-romana/";
const ARCHIVE_API_URL =
  "https://api.arhivabac.com/exams/examCategories/romana";

const manualPairs = [
  ministryPair(
    2026,
    "final",
    "Sesiunea iunie-iulie",
    "29 iunie 2026",
    "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ea_2026_ses_iunie.zip",
    "Ea_2026_ses_iunie/E_a_romana_real_tehn_2026_var_06.pdf",
    "Ea_2026_ses_iunie/E_a_romana_real_tehn_2026_bar_06.pdf",
  ),
  ministryPair(
    2026,
    "reserve",
    "Rezerva iunie-iulie",
    "29 iunie 2026",
    "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ea_2026_ses_iunie_rezerva.zip",
    "Ea_2026_ses_iunie_rezerva/E_a_romana_real_tehn_2026_var_05.pdf",
    "Ea_2026_ses_iunie_rezerva/E_a_romana_real_tehn_2026_bar_05.pdf",
  ),
  ministryPair(
    2026,
    "special",
    "Sesiunea speciala",
    "18 mai 2026",
    "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ea_2026_Sesiune_speciala.zip",
    "Ea_2026_Sesiune_speciala/E_a_romana_real_tehn_2026_var_03.pdf",
    "Ea_2026_Sesiune_speciala/E_a_romana_real_tehn_2026_bar_03.pdf",
  ),
];

function ministryPair(
  year,
  sessionType,
  sessionLabel,
  dateLabel,
  zipUrl,
  subjectEntry,
  baremEntry,
) {
  return {
    year,
    sessionType,
    sessionLabel,
    dateLabel,
    sourceKind: "ministry",
    subject: { zipUrl, entry: subjectEntry },
    barem: { zipUrl, entry: baremEntry },
  };
}

function pair(
  year,
  sessionType,
  sessionLabel,
  dateLabel,
  subjectUrl,
  baremUrl,
  sourceKind = "vetted-mirror",
) {
  return {
    year,
    sessionType,
    sessionLabel,
    dateLabel,
    sourceKind,
    subject: { url: subjectUrl },
    barem: { url: baremUrl },
  };
}

function classify(label) {
  const text = label.toLowerCase();
  if (text.includes("model")) return "model";
  if (text.includes("simulare")) return "simulation";
  if (text.includes("ss") || text.includes("special")) return "special";
  if (text.includes("rezerv")) return "reserve";
  if (text.includes("s2") || text.includes("august")) return "autumn";
  return "final";
}

function sessionLabel(type, sourceLabel) {
  if (type === "model") return "Model oficial";
  if (type === "simulation") return "Simulare nationala";
  if (type === "special") return "Sesiunea speciala";
  if (type === "reserve") {
    return sourceLabel.toLowerCase().includes("s2")
      ? "Rezerva august"
      : "Rezerva iunie-iulie";
  }
  if (type === "autumn") return "Sesiunea august";
  return "Sesiunea iunie-iulie";
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "iabacu-importer/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchJson(url) {
  return JSON.parse((await fetchBuffer(url)).toString("utf8"));
}

async function downloadPdf(source, targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  if (source.url) {
    await writeFile(targetPath, await fetchBuffer(source.url));
    return source.sourceUrl ?? source.url;
  }

  const zipFile = path.join(tmpRoot, `${slugify(path.basename(source.zipUrl))}.zip`);
  await mkdir(tmpRoot, { recursive: true });
  try {
    await readFile(zipFile);
  } catch {
    await writeFile(zipFile, await fetchBuffer(source.zipUrl));
  }
  const bytes = execFileSync("unzip", ["-p", zipFile, source.entry]);
  await writeFile(targetPath, bytes);
  return `${source.zipUrl}#${source.entry}`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function extractPdfText(pdfPath) {
  try {
    return execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    })
      .replace(/\u000c/g, "\n\n--- page ---\n\n")
      .trim();
  } catch (error) {
    console.warn(`Text extraction failed for ${pdfPath}: ${error.message}`);
    return "";
  }
}

async function discoverHeiProfuPairs() {
  const html = (await fetchBuffer(HEI_PROFU_URL)).toString("utf8");
  const re = /data-link-url="([^"]+\.pdf)"[^>]+data-link-text="([^"]+)"/g;
  const rows = [];
  let match;
  while ((match = re.exec(html))) {
    rows.push({ url: match[1], text: match[2].replace(/&nbsp;/g, " ") });
  }

  const pairs = [];
  for (let i = 0; i < rows.length; i += 2) {
    const subject = rows[i];
    const barem = rows[i + 1];
    if (!subject || !barem || /barem/i.test(subject.text)) continue;
    if (/test\s+\d/i.test(subject.text)) break;
    if (!/romana_real_tehn/i.test(subject.url)) continue;

    const yearMatch = subject.text.match(/20\d{2}/);
    if (!yearMatch || !/barem/i.test(barem.text)) continue;
    const year = Number(yearMatch[0]);
    const type = classify(subject.text);
    pairs.push(
      pair(
        year,
        type,
        sessionLabel(type, subject.text),
        `${year}`,
        subject.url,
        barem.url,
      ),
    );
  }
  return pairs;
}

async function discoverArchivePairs() {
  const data = await fetchJson(ARCHIVE_API_URL);
  const pairs = [];

  for (const sessions of Object.values(data.exams)) {
    for (const exams of Object.values(sessions)) {
      const exam =
        exams.find((item) => item.specialization?.tags?.includes("real")) ??
        exams.find((item) => /real[_-]tehn/i.test(item.subject.subjectName));
      if (!exam) continue;

      const detail = await fetchJson(`https://api.arhivabac.com/exams/${exam.examID}`);
      const subjectPdf = detail.exam.pdfs.find((pdf) => pdf.pdfType === 0);
      const baremPdf = detail.exam.pdfs.find((pdf) => pdf.pdfType === 1);
      if (!subjectPdf?.url || !baremPdf?.url) continue;

      const type = classify(exam.session.sessionName);
      const sourcePage = `https://www.arhivabac.com/subiecte-bac/romana/${exam.examID}-${exam.slug}`;
      pairs.push(
        pair(
          exam.year,
          type,
          sessionLabel(type, exam.session.sessionName),
          `${exam.year}`,
          subjectPdf.url,
          baremPdf.url,
        ),
      );
      pairs.at(-1).subject.sourceUrl = `${sourcePage}#subiect`;
      pairs.at(-1).barem.sourceUrl = `${sourcePage}#barem`;
    }
  }
  return pairs;
}

async function buildExam(pairData, index) {
  const labelSlug = slugify(`${pairData.sessionType}-${pairData.sessionLabel}`);
  const id = `romana-${pairData.year}-${labelSlug}`;
  const yearDir = path.join(publicRoot, String(pairData.year));
  const subjectFile = `${id}-subiect.pdf`;
  const baremFile = `${id}-barem.pdf`;
  const subjectDiskPath = path.join(yearDir, subjectFile);
  const baremDiskPath = path.join(yearDir, baremFile);

  const subjectSource = await downloadPdf(pairData.subject, subjectDiskPath);
  const baremSource = await downloadPdf(pairData.barem, baremDiskPath);
  const subjectBytes = await readFile(subjectDiskPath);
  const baremBytes = await readFile(baremDiskPath);
  const contextPath = path.join(textRoot, `${id}.json`);

  await mkdir(textRoot, { recursive: true });
  await writeFile(
    contextPath,
    `${JSON.stringify(
      {
        examId: id,
        subjectText: extractPdfText(subjectDiskPath),
        baremText: extractPdfText(baremDiskPath),
      },
      null,
      2,
    )}\n`,
  );

  return {
    id,
    year: pairData.year,
    order: index,
    subject: "romana",
    profile: "real-tehnologic",
    language: "LRO",
    sessionType: pairData.sessionType,
    sessionLabel: pairData.sessionLabel,
    dateLabel: pairData.dateLabel,
    title: `${pairData.sessionLabel} ${pairData.year}`,
    examPdfPath: `/exams/romana/${pairData.year}/${subjectFile}`,
    baremPdfPath: `/exams/romana/${pairData.year}/${baremFile}`,
    contextPath: `src/data/exam-text/romana/${id}.json`,
    sourceKind: pairData.sourceKind,
    sourceUrl: subjectSource,
    baremSourceUrl: baremSource,
    sha256: {
      exam: sha256(subjectBytes),
      barem: sha256(baremBytes),
    },
  };
}

async function main() {
  await rm(publicRoot, { recursive: true, force: true });
  await rm(textRoot, { recursive: true, force: true });
  await rm(tmpRoot, { recursive: true, force: true });

  const [heiPairs, archivePairs] = await Promise.all([
    discoverHeiProfuPairs(),
    discoverArchivePairs(),
  ]);
  const allPairs = [...manualPairs, ...heiPairs, ...archivePairs];
  const seen = new Set();
  const uniquePairs = allPairs.filter((pairData) => {
    const key = `${pairData.year}:${pairData.sessionType}:${pairData.sessionLabel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  uniquePairs.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    const order = ["model", "simulation", "special", "final", "reserve", "autumn"];
    return order.indexOf(a.sessionType) - order.indexOf(b.sessionType);
  });

  const exams = [];
  for (let i = 0; i < uniquePairs.length; i += 1) {
    const exam = await buildExam(uniquePairs[i], i);
    exams.push(exam);
    console.log(`Imported ${exam.id}`);
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(exams, null, 2)}\n`);
  await rm(tmpRoot, { recursive: true, force: true });
  console.log(`Wrote ${exams.length} exams to ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
