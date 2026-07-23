import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public", "exams");
const textRoot = path.join(root, "src", "data", "exam-text");
const manifestPath = path.join(root, "src", "data", "exams.json");
const tmpRoot = path.join(root, ".tmp-exam-import");

const HEI_PROFU_URL =
  "https://heiprofu.ro/examene-matematica/bacalaureat-matematica/subiecte-bac-m1-mate-info/";

const manualPairs = [
  {
    year: 2026,
    sessionType: "final",
    sessionLabel: "Sesiunea iunie-iulie",
    dateLabel: "1 iulie 2026",
    sourceKind: "ministry",
    subject: {
      zipUrl:
        "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ec_2026_ses_iunie-iulie_01072026.zip",
      entry:
        "Ec_2026_ses_iunie-iulie/E_c_matematica_M_mate-info_2026_var_03_LRO.pdf",
    },
    barem: {
      zipUrl:
        "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ec_2026_ses_iunie-iulie_01072026.zip",
      entry:
        "Ec_2026_ses_iunie-iulie/E_c_matematica_M_mate-info_2026_bar_03_LRO.pdf",
    },
  },
  {
    year: 2026,
    sessionType: "reserve",
    sessionLabel: "Rezerva iunie-iulie",
    dateLabel: "1 iulie 2026",
    sourceKind: "ministry",
    subject: {
      zipUrl:
        "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ec_2026_ses_iunie-iulie_Rezerva.zip",
      entry:
        "Ec_2026_ses_iunie-iulie_Rezerva/E_c_matematica_M_mate-info_2026_var_07_LRO.pdf",
    },
    barem: {
      zipUrl:
        "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ec_2026_ses_iunie-iulie_Rezerva.zip",
      entry:
        "Ec_2026_ses_iunie-iulie_Rezerva/E_c_matematica_M_mate-info_2026_bar_07_LRO.pdf",
    },
  },
  {
    year: 2026,
    sessionType: "special",
    sessionLabel: "Sesiunea speciala",
    dateLabel: "19 mai 2026",
    sourceKind: "ministry",
    subject: {
      zipUrl:
        "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ec_2026_ses_speciala.zip",
      entry:
        "Ec_2026_ses_speciala/E_c_matematica_M_mate-info_2026_var_02_LRO.pdf",
    },
    barem: {
      zipUrl:
        "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme/Ec_2026_ses_speciala.zip",
      entry:
        "Ec_2026_ses_speciala/E_c_matematica_M_mate-info_2026_bar_02_LRO.pdf",
    },
  },
  {
    year: 2026,
    sessionType: "simulation",
    sessionLabel: "Simulare nationala",
    dateLabel: "24 martie 2026",
    sourceKind: "ministry",
    subject: {
      zipUrl:
        "https://subiecte.edu.ro/2026/simulare/simulare_bac_XII/E_c_2026_Simulare.zip",
      entry:
        "E_c_2026_Simulare/E_c_matematica_M_mate-info_2026_var_simulare_LRO.pdf",
    },
    barem: {
      zipUrl:
        "https://subiecte.edu.ro/2026/simulare/simulare_bac_XII/E_c_2026_Simulare.zip",
      entry:
        "E_c_2026_Simulare/E_c_matematica_M_mate-info_2026_bar_simulare_LRO.pdf",
    },
  },
  pair(
    2026,
    "model",
    "Model oficial",
    "1 noiembrie 2025",
    "https://www.e3.ro/wp-content/uploads/2025/11/E_c_matematica_M_mate-info_2026_var_model.pdf",
    "https://www.e3.ro/wp-content/uploads/2025/11/E_c_matematica_M_mate-info_2026_bar_model.pdf",
  ),
  pair(
    2025,
    "final",
    "Sesiunea iunie",
    "11 iunie 2025",
    "https://www.e3.ro/wp-content/uploads/2025/06/E_c_matematica_M_mate-info_2025_var_01_LRO.pdf",
    "https://www.e3.ro/wp-content/uploads/2025/06/E_c_matematica_M_mate-info_2025_bar_01_LRO.pdf",
  ),
  pair(
    2025,
    "autumn",
    "Sesiunea august",
    "12 august 2025",
    "https://www.e3.ro/wp-content/uploads/2025/08/E_c_matematica_M_mate-info_2025_var_09_LRO.pdf",
    "https://www.e3.ro/wp-content/uploads/2025/08/E_c_matematica_M_mate-info_2025_bar_09_LRO.pdf",
  ),
  pair(
    2025,
    "special",
    "Sesiunea speciala",
    "22 mai 2025",
    "https://www.e3.ro/wp-content/uploads/2025/05/E_c_matematica_M_mate-info_2025_var_03_LRO.pdf",
    "https://www.e3.ro/wp-content/uploads/2025/05/E_c_matematica_M_mate-info_2025_bar_03_LRO.pdf",
  ),
  pair(
    2025,
    "model",
    "Model oficial",
    "noiembrie 2024",
    "https://www.e3.ro/wp-content/uploads/2024/11/E_c_matematica_M_mate-info_2025_var_model.pdf",
    "https://www.e3.ro/wp-content/uploads/2024/11/E_c_matematica_M_mate-info_2025_bar_model.pdf",
  ),
  pair(
    2025,
    "simulation",
    "Simulare nationala",
    "25 martie 2025",
    "https://www.e3.ro/wp-content/uploads/2025/03/E_c_matematica_M_mate-info_2025_var_simulare_LRO.pdf",
    "https://www.e3.ro/wp-content/uploads/2025/03/E_c_matematica_M_mate-info_2025_bar_simulare_LRO.pdf",
  ),
];

function pair(year, sessionType, sessionLabel, dateLabel, subjectUrl, baremUrl) {
  return {
    year,
    sessionType,
    sessionLabel,
    dateLabel,
    sourceKind: "vetted-mirror",
    subject: { url: subjectUrl },
    barem: { url: baremUrl },
  };
}

function classify(label) {
  const text = label.toLowerCase();
  if (text.includes("model")) return "model";
  if (text.includes("simulare")) return "simulation";
  if (text.includes("ss")) return "special";
  if (text.includes("rezerv")) return "reserve";
  if (text.includes("s2")) return "autumn";
  return "final";
}

function romanianSessionLabel(type, label) {
  if (type === "model") return "Model oficial";
  if (type === "simulation") return "Simulare nationala";
  if (type === "special") return "Sesiunea speciala";
  if (type === "reserve") return label.toLowerCase().includes("s2")
    ? "Rezerva august"
    : "Rezerva iunie-iulie";
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

async function downloadPdf(source, targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  if (source.url) {
    await writeFile(targetPath, await fetchBuffer(source.url));
    return source.url;
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

async function discoverMirrorPairs() {
  const html = (await fetchBuffer(HEI_PROFU_URL)).toString("utf8");
  const re =
    /data-link-url="([^"]+\.pdf)"[^>]+data-link-text="([^"]+)"/g;
  const rows = [];
  let match;
  while ((match = re.exec(html))) {
    rows.push({
      url: match[1],
      text: match[2].replace(/&nbsp;/g, " "),
    });
  }

  const pairs = [];
  for (let i = 0; i < rows.length; i += 2) {
    const subject = rows[i];
    const barem = rows[i + 1];
    if (!subject || !barem || /barem/i.test(subject.text)) continue;

    const yearMatch =
      subject.text.match(/20\d{2}/) ?? subject.url.match(/20\d{2}/);
    if (!yearMatch) continue;
    const year = Number(yearMatch[0]);
    if (year < 2013 || year > 2024) continue;
    if (/test\s*\d|subiect|constanta|braila|giurgiu|dolj|timis|vrancea|iasi|hunedoara|ilfov|maramures|calarasi/i.test(
      `${subject.text} ${subject.url}`,
    )) {
      continue;
    }

    const sessionType = classify(subject.text);
    pairs.push(
      pair(
        year,
        sessionType,
        romanianSessionLabel(sessionType, subject.text),
        `${year}`,
        subject.url,
        barem.url,
      ),
    );
  }
  return pairs;
}

async function buildExam(pairData, index) {
  const labelSlug = slugify(`${pairData.sessionType}-${pairData.sessionLabel}`);
  const id = `bac-${pairData.year}-${labelSlug}`;
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
    subject: "matematica",
    year: pairData.year,
    order: index,
    profile: "M_mate-info",
    language: "LRO",
    sessionType: pairData.sessionType,
    sessionLabel: pairData.sessionLabel,
    dateLabel: pairData.dateLabel,
    title: `${pairData.sessionLabel} ${pairData.year}`,
    examPdfPath: `/exams/${pairData.year}/${subjectFile}`,
    baremPdfPath: `/exams/${pairData.year}/${baremFile}`,
    contextPath: `src/data/exam-text/${id}.json`,
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

  const discoveredPairs = await discoverMirrorPairs();
  const allPairs = [...manualPairs, ...discoveredPairs];
  const seen = new Set();
  const uniquePairs = allPairs.filter((pairData) => {
    const key = `${pairData.year}:${pairData.sessionType}:${pairData.sessionLabel}:${pairData.subject.url ?? pairData.subject.entry}`;
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
