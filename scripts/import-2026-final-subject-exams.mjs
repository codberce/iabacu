import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceBase = "https://subiecte.edu.ro/2026/bacalaureat/Subiecte_si_bareme";
const sourceZip = "Ed_2026_ses_iunie-iulie.zip";
const historyZip = "Ec_2026_ses_iunie-iulie_01072026.zip";
const romanianZip = "Ea_2026_ses_iunie.zip";
const downloads = path.join(process.env.TMPDIR ?? "/tmp", "iabacu-bac-2026-final");
const output = path.join(root, "public", "exams", "2026");
const contextOutput = path.join(root, "src", "data", "exam-text", "official-2026");

const exams = [
  {
    id: "istorie-2026-final-sesiunea-iunie-iulie", subject: "istorie", profile: "General",
    zip: historyZip, exam: "E_c_istorie_2026_var_03_LRO.pdf", barem: "E_c_istorie_2026_bar_03_LRO.pdf",
  },
  {
    id: "matematica-2026-final-stiintele-naturii", subject: "matematica", profile: "Științele Naturii",
    zip: historyZip, manifest: "src/data/archive-matematica.json",
    exam: "E_c_matematica_M_st-nat_2026_var_03_LRO.pdf", barem: "E_c_matematica_M_st-nat_2026_bar_03_LRO.pdf",
  },
  {
    id: "matematica-2026-final-tehnologic", subject: "matematica", profile: "Tehnologic",
    zip: historyZip, manifest: "src/data/archive-matematica.json",
    exam: "E_c_matematica_M_tehnologic_2026_var_03_LRO.pdf", barem: "E_c_matematica_M_tehnologic_2026_bar_03_LRO.pdf",
  },
  {
    id: "matematica-2026-final-pedagogic", subject: "matematica", profile: "Pedagogic",
    zip: historyZip, manifest: "src/data/archive-matematica.json",
    exam: "E_c_matematica_M_pedagogic_2026_var_03_LRO.pdf", barem: "E_c_matematica_M_pedagogic_2026_bar_03_LRO.pdf",
  },
  {
    id: "romana-2026-final-uman-pedagogic", subject: "romana", profile: "Uman-Pedagogic",
    zip: romanianZip, manifest: "src/data/archive-romana.json",
    exam: "E_a_romana_uman_ped_2026_var_06.pdf", barem: "E_a_romana_uman_ped_2026_bar_06.pdf",
  },
  {
    id: "biologie-2026-final-anatomie-fiziologie", subject: "biologie", profile: "Anatomie și Fiziologie",
    exam: "E_d_anat_fiz_gen_ec_um_2026_var_03_LRO.pdf", barem: "E_d_anat_fiz_gen_ec_um_2026_bar_03_LRO.pdf",
  },
  {
    id: "biologie-2026-final-vegetala-animala", subject: "biologie", profile: "Vegetală și Animală",
    exam: "E_d_bio_veg_anim_2026_var_03_LRO.pdf", barem: "E_d_bio_veg_anim_2026_bar_03_LRO.pdf",
  },
  {
    id: "chimie-2026-final-anorganica", subject: "chimie", profile: "Anorganică",
    exam: "E_d_chimie_anorganica_2026_var_03_LRO.pdf", barem: "E_d_chimie_anorganica_2026_bar_03_LRO.pdf",
  },
  {
    id: "chimie-2026-final-organica", subject: "chimie", profile: "Organică",
    exam: "E_d_chimie_organica_2026_var_03_LRO.pdf", barem: "E_d_chimie_organica_2026_bar_03_LRO.pdf",
  },
  {
    id: "economie-2026-final-sesiunea-iunie-iulie", subject: "economie", profile: "General",
    exam: "E_d_economie_2026_var_03_LRO.pdf", barem: "E_d_economie_2026_bar_03_LRO.pdf",
  },
  {
    id: "filosofie-2026-final-sesiunea-iunie-iulie", subject: "filosofie", profile: "General",
    exam: "E_d_filosofie_2026_var_03_LRO.pdf", barem: "E_d_filosofie_2026_bar_03_LRO.pdf",
  },
  {
    id: "geografie-2026-final-sesiunea-iunie-iulie", subject: "geografie", profile: "General",
    exam: "E_d_geografie_2026_var_03_LRO.pdf", barem: "E_d_geografie_2026_bar_03_LRO.pdf",
  },
  {
    id: "informatica-2026-final-sesiunea-iunie-iulie", subject: "informatica", profile: "Mate-Info (MI), C/C++",
    exam: "E_d_Informatica_2026_sp_MI_C_var_03_LRO.pdf", barem: "E_d_Informatica_2026_sp_MI_bar_03_LRO.pdf",
    manifest: "src/data/exams-informatica.json",
  },
  {
    id: "informatica-2026-final-mi-pascal", subject: "informatica", profile: "Mate-Info (MI), Pascal",
    manifest: "src/data/archive-informatica.json",
    exam: "E_d_Informatica_2026_sp_MI_Pascal_var_03_LRO.pdf", barem: "E_d_Informatica_2026_sp_MI_bar_03_LRO.pdf",
  },
  {
    id: "informatica-2026-final-sn-c-cpp", subject: "informatica", profile: "Științele Naturii (SN), C/C++",
    manifest: "src/data/archive-informatica.json",
    exam: "E_d_Informatica_2026_sp_SN_C_var_03_LRO.pdf", barem: "E_d_Informatica_2026_sp_SN_bar_03_LRO.pdf",
  },
  {
    id: "logica-2026-final-sesiunea-iunie-iulie", subject: "logica", profile: "General",
    exam: "E_d_logica_2026_var_03_LRO.pdf", barem: "E_d_logica_2026_bar_03_LRO.pdf",
  },
  {
    id: "psihologie-2026-final-sesiunea-iunie-iulie", subject: "psihologie", profile: "General",
    exam: "E_d_psihologie_2026_var_03_LRO.pdf", barem: "E_d_psihologie_2026_bar_03_LRO.pdf",
  },
  {
    id: "sociologie-2026-final-sesiunea-iunie-iulie", subject: "sociologie", profile: "General",
    exam: "E_d_sociologie_2026_var_03_LRO.pdf", barem: "E_d_sociologie_2026_bar_03_LRO.pdf",
  },
  {
    id: "fizica-2026-final", subject: "fizica", profile: "F_fizica_teoretic_vocational",
    exam: "E_d_fizica_teoretic_vocational_2026_var_03_LRO.pdf", barem: "E_d_fizica_teoretic_vocational_2026_bar_03_LRO.pdf",
    manifest: "src/data/exams-fizica.json",
  },
  {
    id: "fizica-2026-final-tehnologic", subject: "fizica", profile: "Tehnologic",
    manifest: "src/data/archive-fizica.json",
    exam: "E_d_fizica_tehnologic_2026_var_03_LRO.pdf", barem: "E_d_fizica_tehnologic_2026_bar_03_LRO.pdf",
  },
];

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function zipEntry(zipPath, filename) {
  const entry = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split("\n")
    .find((candidate) => candidate.endsWith(`/${filename}`));
  if (!entry) throw new Error(`Missing ${filename} in ${zipPath}`);
  return execFileSync("unzip", ["-p", zipPath, entry]);
}

function pdfText(pdfPath) {
  return execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" })
    .replace(/\f/g, "\n\n--- page ---\n\n")
    .trim();
}

async function download(zip) {
  const target = path.join(downloads, zip);
  try {
    await readFile(target);
  } catch {
    const response = await fetch(`${sourceBase}/${zip}`);
    if (!response.ok) throw new Error(`Could not download ${zip}: ${response.status}`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
  return target;
}

async function updateManifest(relativePath, record) {
  const manifestPath = path.join(root, relativePath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const index = manifest.findIndex((entry) => entry.id === record.id);
  if (index === -1) manifest.push(record);
  else manifest[index] = { ...record, order: manifest[index].order };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  await Promise.all([mkdir(downloads, { recursive: true }), mkdir(output, { recursive: true }), mkdir(contextOutput, { recursive: true })]);
  const zipPaths = new Map();
  for (const zip of new Set(exams.map((exam) => exam.zip ?? sourceZip))) zipPaths.set(zip, await download(zip));

  for (const [position, exam] of exams.entries()) {
    const zip = exam.zip ?? sourceZip;
    const [subjectBytes, baremBytes] = [zipEntry(zipPaths.get(zip), exam.exam), zipEntry(zipPaths.get(zip), exam.barem)];
    const subjectPath = path.join(output, `${exam.id}-subiect.pdf`);
    const baremPath = path.join(output, `${exam.id}-barem.pdf`);
    const contextPath = path.join(contextOutput, `${exam.id}.json`);
    await Promise.all([writeFile(subjectPath, subjectBytes), writeFile(baremPath, baremBytes)]);
    await writeFile(contextPath, `${JSON.stringify({ examId: exam.id, subjectText: pdfText(subjectPath), baremText: pdfText(baremPath) }, null, 2)}\n`);

    const record = {
      id: exam.id, subject: exam.subject, year: 2026, order: 100 + position,
      profile: exam.profile, language: "LRO", sessionType: "final", sessionLabel: "Sesiunea iunie-iulie",
      dateLabel: exam.subject === "romana"
        ? "29 iunie 2026"
        : exam.subject === "istorie" || exam.subject === "matematica"
          ? "1 iulie 2026"
          : "2 iulie 2026",
      title: `Sesiunea iunie-iulie 2026 · ${exam.profile}`,
      examPdfPath: `/exams/2026/${exam.id}-subiect.pdf`, baremPdfPath: `/exams/2026/${exam.id}-barem.pdf`,
      contextPath: `src/data/exam-text/official-2026/${exam.id}.json`, sourceKind: "ministry",
      sourceUrl: `${sourceBase}/${zip}#${exam.exam}`, baremSourceUrl: `${sourceBase}/${zip}#${exam.barem}`,
      sha256: { exam: hash(subjectBytes), barem: hash(baremBytes) },
    };
    await updateManifest(exam.manifest ?? `src/data/archive-${exam.subject}.json`, record);
    console.log(`Imported ${exam.id}`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
