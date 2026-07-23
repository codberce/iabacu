import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = "https://api.arhivabac.com/exams";
const historicalRomanianExams = [
  [2010, "12 iunie 2010", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_viii_limba_si_literatura_romana_subiect_7.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_viii_limba_si_literatura_romana_barem_7.pdf"],
  [2011, "22 iunie 2011", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluare-nationala-2011-subiect-barem-limba-romana-sesiunea-iunie.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluare-nationala-2011-subiect-barem-limba-romana-sesiunea-iunie.pdf"],
  [2012, "27 iunie 2012", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-2012-sesiunea-iunie.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-2012-sesiunea-iunie-barem.pdf"],
  [2013, "27 iunie 2013", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/subiect-evaluarea-nationala-limba-si-literatura-romana-2013.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/barem-corectare-notare-evaluarea-nationala-limba-romana-2013.pdf"],
  [2014, "25 iunie 2014", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-sesiunea-iunie-2014.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/barem-evaluarea-nationala-limba-romana-sesiunea-iunie-2014.pdf"],
  [2015, "24 iunie 2015", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/subiectebarem-evaluarea-nationala-limba-romana-sesiunea-iunie-2015.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/subiectebarem-evaluarea-nationala-limba-romana-sesiunea-iunie-2015.pdf"],
  [2016, "29 iunie 2016", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2016_var_02.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2016_bar_02.pdf"],
  [2017, "19 iunie 2017", "https://profesorjitaruionel.com/wp-content/uploads/2017/06/en_limba_romana_2017_var_04.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2017/06/en_limba_romana_2017_bar_04.pdf"],
  [2018, "11 iunie 2018", "https://profesorjitaruionel.com/wp-content/uploads/2018/06/EN_limba_romana_2018_var_02.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/06/EN_limba_romana_2018_bar_02.pdf"],
  [2019, "18 iunie 2019", "https://profesorjitaruionel.com/wp-content/uploads/2019/06/EN_limba_romana_2019_var_01.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2019/06/EN_limba_romana_2019_bar_01.pdf"],
  [2020, "15 iunie 2020", "https://profesorjitaruionel.com/wp-content/uploads/2020/06/EN_VIII_Limba_romana_2020_var_05.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2020/06/EN_VIII_Limba_romana_2020_bar_05.pdf"],
  [2021, "22 iunie 2021", "https://profesorjitaruionel.com/wp-content/uploads/2021/06/EN_VIII_2021_Limba_si_literatura_romana_var_04.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2021/06/EN_VIII_2021_Limba_si_literatura_romana_bar_04.pdf"],
  [2022, "14 iunie 2022", "https://profesorjitaruionel.com/wp-content/uploads/2022/06/EN_VIII_2022_Limba_si_literatura_romana_var_04-1.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2022/06/EN_VIII_2022_Limba_si_literatura_romana_bar_04.pdf"],
  [2022, "18 iunie 2022", "https://profesorjitaruionel.com/wp-content/uploads/2022/06/EN_VIII_2022_Limba_si_literatura_romana_var_05.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2022/06/EN_VIII_2022_Limba_si_literatura_romana_bar_05.pdf", "Rezerva", "05"],
  [2022, "2022", "https://profesorjitaruionel.com/wp-content/uploads/2021/11/EN_VIII_2022_Limba_si_literatura_romana_var_model.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2021/11/EN_VIII_2022_limba_si_literatura_romana_bar_model.pdf", "Model", "model"],
  [2021, "iulie 2021", "https://profesorjitaruionel.com/wp-content/uploads/2021/07/EN_VIII_2021_Limba-romana-REZERVA-var_02.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2021/07/EN_VIII_2021_Limba-romana-REZERVA-bar_02.pdf", "Rezerva", "02"],
  [2021, "iulie 2021", "https://profesorjitaruionel.com/wp-content/uploads/2021/07/EN_VIII_2021_Limba_si_literatura_romana_var_03.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2021/07/EN_VIII_2021_Limba_si_literatura_romana_bar_03.pdf", "Sesiunea specială", "03"],
  [2020, "2020", "https://profesorjitaruionel.com/wp-content/uploads/2019/11/EN_Limba_romana_2020_var_model.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2019/11/EN_Limba_romana_2020_bar_model.pdf", "Model", "model"],
  [2019, "2019", "https://profesorjitaruionel.com/wp-content/uploads/2018/11/EN_limba_romana_2019_var_model.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/11/EN_limba_romana_2019_bar_model.pdf", "Model", "model"],
  [2019, "martie 2019", "https://profesorjitaruionel.com/wp-content/uploads/2019/03/EN_limba_romana_2019_cl_VIII_var_simulare.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2019/03/EN_limba_romana_2019_cl_VIII_bar_simulare-1.pdf", "Simulare", "nationala"],
  [2018, "2018", "https://profesorjitaruionel.com/wp-content/uploads/2018/09/EN-limba-romana-2018-sesiunea-iunie-REZERVA.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/09/EN-limba-romana-2018-sesiunea-iunie-REZERVA-barem.pdf", "Rezerva", "rezerva"],
  [2018, "2018", "https://profesorjitaruionel.com/wp-content/uploads/2018/09/en_limba_romana_2018_var_simulare.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/09/en_limba_romana_2018_bar_simulare.pdf", "Simulare", "nationala"],
  [2018, "2018", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2018_var_model.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2018_bar_model.pdf", "Model", "model"],
  [2017, "2017", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2017_var_01-iunie-rezerva.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2017_bar_01-iunie-rezerva.pdf", "Rezerva", "01"],
  [2017, "2017", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2017_var_09-sesiune-olimpici13-06-2017.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2017_bar_09-sesiune-olimpici13-06-2017.pdf", "Sesiunea specială", "09"],
  [2017, "13 martie 2017", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2017_var_simulare-13-03-2017.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2017_bar_simulare-13-03-2017.pdf", "Simulare", "nationala"],
  [2017, "2017", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_var_model_2017.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_bar_model_2017.pdf", "Model", "model"],
  [2016, "2016", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2016_var_simulare1.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2016_bar_simulare1.pdf", "Simulare", "nationala"],
  [2016, "2016", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2016_var_08.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2016_bar_08.pdf", "Sesiunea specială", "08"],
  [2016, "2016", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2016_var_07.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2016_bar_07.pdf", "Rezerva", "07"],
  [2016, "2016", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_viii_limba_romana_2016_var_model.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_viii_limba_romana_2016_bar_model.pdf", "Model", "model"],
  [2014, "2014", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-model-2014.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-barem-model-2014.pdf", "Model", "model"],
  [2014, "2014", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2014_var_simulare1.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en_limba_romana_2014_bar_simulare1.pdf", "Simulare", "nationala"],
  [2014, "2014", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-sesiunea-iunie-2014-rezerva.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-sesiunea-iunie-2014-rezerva-barem.pdf", "Rezerva", "rezerva"],
  [2014, "2014", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-2014-sesiunea-olimpici.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/barem-en-viii-limba-romana-2014-sesiunea-olimpici.pdf", "Sesiunea specială", "speciala"],
  [2013, "2013", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/simulare-en-2013-romana1.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/barem-simulare-en-2013-romana1.pdf", "Simulare", "nationala"],
  [2013, "2013", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-sesiunea-iunie-2013-rezerva.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-sesiunea-iunie-2013-rezerva-barem.pdf", "Rezerva", "rezerva"],
  [2013, "2013", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en-viii-limba-romana-2013-sesiunea-olimpici.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/en-viii-limba-romana-2013-sesiunea-olimpici-barem.pdf", "Sesiunea specială", "speciala"],
  [2010, "2010", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-model-2010.pdf", "https://profesorjitaruionel.com/wp-content/uploads/2018/02/evaluarea-nationala-limba-romana-model-2010-barem.pdf", "Model", "model"],
];

const official2026Exams = {
  romana: [
    {
      dateLabel: "2026", sessionLabel: "Model", variant: "model",
      archiveUrl: "https://subiecte.edu.ro/2026/evaluarenationala/modeledesubiecte/EN_VIII_2026_Limba_romana_modele.zip",
      examEntry: "EN_VIII_2026_limba_si_literatura_romana_var_model.pdf",
      baremEntry: "EN_VIII_2026_limba_si_literatura_romana_bar_model.pdf",
    },
    {
      dateLabel: "16 martie 2026", sessionLabel: "Simulare", variant: "nationala-martie",
      archiveUrl: "https://subiecte.edu.ro/2026/simulare/simulare_en_VIII/EN_VIII_2026_Limba_romana_Simulare.zip",
      examEntry: "EN_VIII_2026_Limba_si_literatura_romana_var_simulare.pdf",
      baremEntry: "EN_VIII_2026_Limba_si_literatura_romana_bar_simulare.pdf",
    },
    {
      dateLabel: "27 aprilie 2026", sessionLabel: "Simulare", variant: "nationala-aprilie",
      archiveUrl: "https://subiecte.edu.ro/2026/simulare/simulare_en_VIII/EN_VIII_2026_Lb_romana_Simulare_2.zip",
      examEntry: "EN_VIII_2026_Limba_si_literatura_romana_var_simulare_2.pdf",
      baremEntry: "EN_VIII_2026_limba_si_literatura_romana_bar_simulare_2.pdf",
    },
    {
      dateLabel: "22 iunie 2026", sessionLabel: "Sesiunea iunie/iulie", variant: "03",
      archiveUrl: "https://subiecte.edu.ro/2026/evaluarenationala/Subiecte_si_bareme/EN_VIII_2026_Lb_Romana.zip",
      examEntry: "EN_VIII_2026_Limba_si_literatura_romana_var_03.pdf",
      baremEntry: "EN_VIII_2026_limba_si_literatura_romana_bar_03.pdf",
    },
    {
      dateLabel: "22 iunie 2026", sessionLabel: "Rezerva", variant: "05",
      archiveUrl: "https://subiecte.edu.ro/2026/evaluarenationala/Subiecte_si_bareme/EN_VIII_2026_Lb_Romana_rezerva.zip",
      examEntry: "EN_VIII_2026_Limba_si_literatura_romana_var_05.pdf",
      baremEntry: "EN_VIII_2026_limba_si_literatura_romana_bar_05.pdf",
    },
  ],
  matematica: [
    {
      dateLabel: "2026", sessionLabel: "Model", variant: "model",
      archiveUrl: "https://subiecte.edu.ro/2026/evaluarenationala/modeledesubiecte/EN_VIII_2026_Matematica_model.zip",
      examEntry: "EN_VIII_2026_Matematica_var_model.pdf",
      baremEntry: "EN_VIII_2026_Matematica_bar_model.pdf",
    },
    {
      dateLabel: "17 martie 2026", sessionLabel: "Simulare", variant: "nationala-martie",
      archiveUrl: "https://subiecte.edu.ro/2026/simulare/simulare_en_VIII/EN_VIII_2026_Matematica_Simulare.zip",
      examEntry: "ENVIII_Matematica_2026_Var_Simulare_LRO.pdf",
      baremEntry: "ENVIII_Matematica_2026_Bar_Simulare_LRO.pdf",
    },
    {
      dateLabel: "28 aprilie 2026", sessionLabel: "Simulare", variant: "nationala-aprilie",
      archiveUrl: "https://subiecte.edu.ro/2026/simulare/simulare_en_VIII/EN_VIII_2026_Matematica_Simulare_2.zip",
      examEntry: "EN_VIII_Matematica_2026_Var_Simulare_2_LRO.pdf",
      baremEntry: "EN_VIII_Matematica_2026_Bar_Simulare_2_LRO.pdf",
    },
    {
      dateLabel: "24 iunie 2026", sessionLabel: "Sesiunea iunie/iulie", variant: "01",
      archiveUrl: "https://subiecte.edu.ro/2026/evaluarenationala/Subiecte_si_bareme/EN_VIII_2026_Matematica.zip",
      examEntry: "ENVIII_Matematica_2026_Var_01_LRO.pdf",
      baremEntry: "ENVIII_Matematica_2026_Bar_01_LRO.pdf",
    },
    {
      dateLabel: "24 iunie 2026", sessionLabel: "Rezerva", variant: "05",
      archiveUrl: "https://subiecte.edu.ro/2026/evaluarenationala/Subiecte_si_bareme/EN_VIII_2026_Matematica_Rezerva.zip",
      examEntry: "ENVIII_Matematica_2026_Var_05_LRO.pdf",
      baremEntry: "ENVIII_Matematica_2026_Bar_05_LRO.pdf",
    },
  ],
};

const categories = [
  { api: "en-romana", subject: "romana" },
  { api: "en-matematica", subject: "matematica" },
];
const allowedSessions = new Set([
  "Model",
  "Simulare",
  "Sesiunea iunie/iulie",
  "Sesiunea specială",
  "Rezerva",
]);
const sessionTypes = {
  Model: "model",
  Simulare: "simulation",
  "Sesiunea iunie/iulie": "final",
  "Sesiunea specială": "special",
  Rezerva: "reserve",
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "iabacu-importer/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function fetchPdf(url) {
  const response = await fetch(url, { headers: { "user-agent": "iabacu-importer/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error(`Not a PDF: ${url}`);
  return bytes;
}

async function fetchArchivePair(row) {
  const response = await fetch(row.archiveUrl, { headers: { "user-agent": "iabacu-importer/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${row.archiveUrl}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "iabacu-en-"));
  const archivePath = path.join(temporaryRoot, "source.zip");
  await writeFile(archivePath, archive);

  try {
    const entries = execFileSync("bsdtar", ["-tf", archivePath], { encoding: "utf8" }).trim().split("\n");
    const findEntry = (name) => entries.find((entry) => path.basename(entry) === name);
    const examEntry = findEntry(row.examEntry);
    const baremEntry = findEntry(row.baremEntry);
    if (!examEntry || !baremEntry) throw new Error(`Missing PDF pair in ${row.archiveUrl}`);
    const archiveOptions = { maxBuffer: 20 * 1024 * 1024 };
    const examBytes = execFileSync("bsdtar", ["-xOf", archivePath, examEntry], archiveOptions);
    const baremBytes = execFileSync("bsdtar", ["-xOf", archivePath, baremEntry], archiveOptions);
    for (const bytes of [examBytes, baremBytes]) {
      if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error(`Not a PDF in ${row.archiveUrl}`);
    }
    return [examBytes, baremBytes];
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function slug(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function textFromPdf(file) {
  return execFileSync("pdftotext", ["-layout", file, "-"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  }).replace(//g, "\n\n--- page ---\n\n").trim();
}

function flattenCatalog(catalog) {
  const rows = [];
  for (const [year, sessions] of Object.entries(catalog.exams)) {
    for (const [sessionLabel, exams] of Object.entries(sessions)) {
      if (!allowedSessions.has(sessionLabel)) continue;
      for (const exam of exams) rows.push({ year: Number(year), sessionLabel, examID: exam.examID });
    }
  }
  return rows;
}

async function main() {
  const sourceCatalog = [];
  for (const category of categories) {
    const publicRoot = path.join(root, "public", "exams", "evaluare-nationala", category.subject);
    const textRoot = path.join(root, "src", "data", "exam-text", "evaluare-nationala", category.subject);
    await mkdir(publicRoot, { recursive: true });
    await mkdir(textRoot, { recursive: true });

    const catalog = await fetchJson(`${apiRoot}/examCategories/${category.api}`);
    const rows = flattenCatalog(catalog)
      .filter((row) => row.year !== 2026 || !["Model", "Simulare"].includes(row.sessionLabel));
    rows.push(...official2026Exams[category.subject].map((row) => ({ ...row, year: 2026 })));
    rows.sort((a, b) => b.year - a.year || (a.examID ?? 0) - (b.examID ?? 0));
    if (category.subject === "romana") {
      rows.push(...historicalRomanianExams.map(([year, dateLabel, examUrl, baremUrl, sessionLabel = "Sesiunea iunie/iulie", variant = "principal"]) => ({
        year, dateLabel, sessionLabel, examUrl, baremUrl, variant,
      })));
      rows.sort((a, b) => b.year - a.year || (a.examID ?? 0) - (b.examID ?? 0));
    }
    const manifest = [];

    for (const [order, row] of rows.entries()) {
      const detail = row.examID ? (await fetchJson(`${apiRoot}/${row.examID}`)).exam : null;
      const subjectPdf = detail?.pdfs.find((pdf) => pdf.pdfType === 0);
      const baremPdf = detail?.pdfs.find((pdf) => pdf.pdfType === 1);
      const subjectUrl = row.examUrl ?? subjectPdf?.url;
      const baremUrl = row.baremUrl ?? baremPdf?.url;
      if (!row.archiveUrl && (!subjectUrl || !baremUrl)) throw new Error(`Missing pair for ${row.examID ?? row.year}`);
      const variant = row.variant ?? detail?.subject.subjectName.match(/(?:var|subiect)[_-]?(\d+|model)/i)?.[1] ?? (row.examID ? String(row.examID) : "principal");
      const id = `en-${category.subject}-${row.year}-${sessionTypes[row.sessionLabel]}-${slug(variant)}`;
      const yearRoot = path.join(publicRoot, String(row.year));
      await mkdir(yearRoot, { recursive: true });
      const examFile = `${id}-subiect.pdf`;
      const baremFile = `${id}-barem.pdf`;
      const examDisk = path.join(yearRoot, examFile);
      const baremDisk = path.join(yearRoot, baremFile);
      const [examBytes, baremBytes] = row.archiveUrl
        ? await fetchArchivePair(row)
        : await Promise.all([fetchPdf(subjectUrl), fetchPdf(baremUrl)]);
      await Promise.all([writeFile(examDisk, examBytes), writeFile(baremDisk, baremBytes)]);
      const subjectText = textFromPdf(examDisk);
      const baremText = textFromPdf(baremDisk);
      if (subjectText.length < 100 || baremText.length < 100) throw new Error(`Empty text for ${id}`);
      const contextPath = `src/data/exam-text/evaluare-nationala/${category.subject}/${id}.json`;
      await writeFile(path.join(root, contextPath), `${JSON.stringify({ examId: id, subjectText, baremText }, null, 2)}\n`);
      const sourcePage = row.archiveUrl ?? (detail
        ? `https://www.arhivabac.com/evaluare-nationala/${category.subject}/${detail.examID}-${detail.slug}`
        : subjectUrl);
      const sourceKind = row.archiveUrl ? "ministry" : "vetted-mirror";
      const verification = row.archiveUrl ? "official-source" : "verified-copy";
      const record = {
        id, category: "evaluare-nationala", subject: category.subject, year: row.year, order,
        profile: "Clasa a VIII-a", language: "LRO", sessionType: sessionTypes[row.sessionLabel],
        sessionLabel: row.sessionLabel, dateLabel: row.dateLabel ?? String(row.year), title: `${row.sessionLabel} ${row.year}`,
        examPdfPath: `/exams/evaluare-nationala/${category.subject}/${row.year}/${examFile}`,
        baremPdfPath: `/exams/evaluare-nationala/${category.subject}/${row.year}/${baremFile}`,
        contextPath, sourceKind, sourceUrl: `${sourcePage}#subiect`,
        baremSourceUrl: `${sourcePage}#barem`, sha256: { exam: sha256(examBytes), barem: sha256(baremBytes) },
        verification: { subject: verification, barem: verification }, durationMinutes: 120,
      };
      manifest.push(record);
      sourceCatalog.push({ examID: detail?.examID ?? null, subject: category.subject, year: row.year, sessionLabel: row.sessionLabel, sourcePage, subjectName: subjectPdf?.name ?? row.examEntry ?? path.basename(subjectUrl), baremName: baremPdf?.name ?? row.baremEntry ?? path.basename(baremUrl) });
      console.log(`Imported ${id}`);
    }

    await writeFile(path.join(root, "src", "data", `exams-evaluare-nationala-${category.subject}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  await writeFile(path.join(root, "scripts", "evaluare-nationala-sources.json"), `${JSON.stringify(sourceCatalog, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exit(1); });
