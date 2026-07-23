import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public", "exams", "informatica");
const textRoot = path.join(root, "src", "data", "exam-text", "informatica");
const manifestPath = path.join(root, "src", "data", "exams-informatica.json");
const archiveUrl = "https://www.arhivabac.com/subiecte-bac/informatica";

// This archive intentionally uses only the theoretical-profile Mate-Info
// C/C++ variant. Science-profile and Pascal variants are excluded.
const profile = "Mate-Info (MI), C/C++";

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "iabacu-importer/1.0" },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "iabacu-importer/1.0" },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function nuxtData(html) {
  const match = html.match(
    /<script type="application\/json"[^>]+id="__NUXT_DATA__">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error("The archive page did not contain Nuxt data");
  return JSON.parse(match[1]);
}

function discoverExams(html) {
  const data = nuxtData(html);
  const value = (reference) =>
    typeof reference === "number" ? data[reference] : reference;
  const exams = [];

  for (const item of data) {
    if (
      !item ||
      Array.isArray(item) ||
      typeof item !== "object" ||
      item.examID === undefined ||
      item.year === undefined ||
      item.subject === undefined ||
      item.barem === undefined ||
      item.specialization === undefined
    ) {
      continue;
    }

    const specialization = value(item.specialization);
    if (value(specialization?.label) !== profile) continue;

    const year = value(item.year);
    if (year < 2013) continue;

    const session = value(item.session);
    const subject = value(item.subject);
    const barem = value(item.barem);
    const subjectName = value(subject.subjectName);
    const sessionName = value(session.sessionName);
    const isReserve =
      year === 2025 && /var_07/i.test(subjectName);

    exams.push({
      archiveId: value(item.examID),
      year,
      sessionName,
      sessionType: isReserve ? "reserve" : classifySession(sessionName),
      subjectName,
      baremName: value(barem.baremName),
      slug: value(item.slug),
    });
  }

  return exams;
}

function classifySession(sessionName) {
  if (sessionName === "Model") return "model";
  if (sessionName === "Simulare") return "simulation";
  if (sessionName.includes("special")) return "special";
  if (sessionName.includes("august")) return "autumn";
  return "final";
}

function sessionLabel(type) {
  const labels = {
    model: "Model oficial",
    simulation: "Simulare nationala",
    special: "Sesiunea speciala",
    final: "Sesiunea iunie-iulie",
    reserve: "Rezerva iunie-iulie",
    autumn: "Sesiunea august",
  };
  return labels[type];
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolvePdfUrls(exam) {
  if (exam.year === 2025 && exam.sessionType === "simulation") {
    const root = "https://infoas.ro/static/assets/bacalaureat/2025";
    return {
      detailUrl: "https://infoas.ro/bacalaureat/subiect/2025",
      subjectUrl: `${root}/E_d_Informatica_2025_sp_MI_C_var_Simulare_LRO.pdf`,
      baremUrl: `${root}/E_d_Informatica_2025_sp_MI_bar_Simulare_LRO.pdf`,
      subjectDownloadUrl: `${root}/E_d_Informatica_2025_sp_MI_C_var_Simulare_LRO.pdf`,
      baremDownloadUrl: `${root}/E_d_Informatica_2025_sp_MI_bar_Simulare_LRO.pdf`,
    };
  }

  const detailUrl = `${archiveUrl}/${exam.archiveId}-${exam.slug}`;
  const html = await fetchText(detailUrl);
  const signedUrls = [
    ...new Set(
      html.match(
        /https:\/\/s3\.arhivabac\.com\/arhivabac\/[^"\\?]+\?[^"\\]+/gi,
      ) ?? [],
    ),
  ].map((url) => url.replaceAll("\\u0026", "&"));

  const find = (name) => {
    const exact = signedUrls.find((url) =>
      new RegExp(`/${escapeRegExp(name)}(?:\\?|$)`, "i").test(url),
    );
    if (exact) return exact;
    const stem = name.replace(/\.pdf$/i, "");
    return signedUrls.find((url) =>
      new RegExp(`/${escapeRegExp(stem)}(?:\\.pdf)?(?:\\?|$)`, "i").test(url),
    );
  };

  const subjectUrl = find(exam.subjectName);
  const baremUrl = find(exam.baremName);
  if (!subjectUrl || !baremUrl) {
    throw new Error(`Could not resolve both PDFs from ${detailUrl}`);
  }
  return {
    detailUrl,
    subjectUrl: subjectUrl.split("?")[0],
    baremUrl: baremUrl.split("?")[0],
    subjectDownloadUrl: subjectUrl,
    baremDownloadUrl: baremUrl,
  };
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

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function buildExam(source, index) {
  const label = sessionLabel(source.sessionType);
  const id = `informatica-${source.year}-${slugify(`${source.sessionType}-${label}`)}`;
  const yearDir = path.join(publicRoot, String(source.year));
  const subjectFile = `${id}-subiect.pdf`;
  const baremFile = `${id}-barem.pdf`;
  const subjectPath = path.join(yearDir, subjectFile);
  const baremPath = path.join(yearDir, baremFile);
  const urls = await resolvePdfUrls(source);
  const [subjectBytes, baremBytes] = await Promise.all([
    fetchBuffer(urls.subjectDownloadUrl),
    fetchBuffer(urls.baremDownloadUrl),
  ]);

  await mkdir(yearDir, { recursive: true });
  await Promise.all([
    writeFile(subjectPath, subjectBytes),
    writeFile(baremPath, baremBytes),
  ]);

  const contextPath = path.join(textRoot, `${id}.json`);
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

  return {
    id,
    subject: "informatica",
    year: source.year,
    order: index,
    profile,
    language: "LRO",
    sessionType: source.sessionType,
    sessionLabel: label,
    dateLabel: String(source.year),
    title: `${label} ${source.year}`,
    examPdfPath: `/exams/informatica/${source.year}/${subjectFile}`,
    baremPdfPath: `/exams/informatica/${source.year}/${baremFile}`,
    contextPath: `src/data/exam-text/informatica/${id}.json`,
    sourceKind: "vetted-mirror",
    sourceUrl: urls.subjectUrl,
    baremSourceUrl: urls.baremUrl,
    sha256: {
      exam: sha256(subjectBytes),
      barem: sha256(baremBytes),
    },
  };
}

async function main() {
  const discovered = discoverExams(await fetchText(archiveUrl));
  const sessionOrder = [
    "model",
    "simulation",
    "special",
    "final",
    "reserve",
    "autumn",
  ];
  discovered.sort(
    (a, b) =>
      b.year - a.year ||
      sessionOrder.indexOf(a.sessionType) -
        sessionOrder.indexOf(b.sessionType),
  );

  await rm(publicRoot, { recursive: true, force: true });
  await rm(textRoot, { recursive: true, force: true });

  const exams = [];
  for (const source of discovered) {
    const exam = await buildExam(source, exams.length);
    exams.push(exam);
    console.log(`Imported ${exam.id}`);
  }

  await writeFile(manifestPath, `${JSON.stringify(exams, null, 2)}\n`);
  console.log(`Wrote ${exams.length} exams to ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
