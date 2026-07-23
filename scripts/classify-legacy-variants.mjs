import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const subjects = new Set(["biologie", "fizica", "informatica", "matematica", "romana"]);

const normalize = (text) => text.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

function classify(subject, firstPage) {
  const text = normalize(firstPage);
  if (subject === "biologie") {
    if (text.includes("biologie vegetala si animala")) return "Vegetală și Animală";
    if (text.includes("anatomie si fiziologie umana")) return "Anatomie și Fiziologie";
  }
  if (subject === "informatica") {
    const track = text.includes("stiintele naturii") ? "Științele Naturii (SN)"
      : text.includes("matematica-informatica") ? "Mate-Info (MI)" : null;
    const language = text.includes("limbajul pascal") ? "Pascal"
      : text.includes("limbajul c/c++") || text.includes("limbajul c++") ? "C/C++" : null;
    if (track && language) return `${track}, ${language}`;
  }
  if (subject === "matematica") {
    if (text.includes("specializarea stiintelor naturii") || text.includes("specializarea stiintele naturii") || text.includes("specializarea stiinte ale naturii")) return "Științele Naturii";
    if (text.includes("specializarea matematica-informatica")) return "Mate-Info";
    if (text.includes("profilul tehnologic")) return "Tehnologic";
    if (text.includes("profilul pedagogic")) return "Pedagogic";
    if (/\bm1\b/.test(text)) return "M1";
    if (/\bm2\b/.test(text)) return "M2";
    if (/\bm4\b/.test(text)) return "M4";
  }
  if (subject === "romana") {
    if (text.includes("profil real") || text.includes("filiera tehnologica")) return "Real-Tehnologic";
    if (text.includes("profilul umanist") || text.includes("profilul pedagogic")) return "Uman-Pedagogic";
  }
  if (subject === "fizica") {
    const theoretical = text.includes("filiera teoretica");
    const technological = text.includes("filiera tehnologica");
    if (theoretical && technological) return "Real · Tehnologic · Militar";
    if (technological) return "Tehnologic";
    if (theoretical) return "Teoretic";
    return "Comun";
  }
  return null;
}

async function readFirstPage(examId) {
  const response = await fetch(`https://api.arhivabac.com/exams/${examId}`);
  if (!response.ok) throw new Error(`Could not load archive record ${examId}`);
  const data = await response.json();
  const pdfUrl = data.exam?.pdfs?.find((pdf) => pdf.pdfType === 0)?.url;
  if (!pdfUrl) throw new Error(`Archive record ${examId} has no subject PDF`);
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) throw new Error(`Could not download PDF for ${examId}`);
  return execFileSync("pdftotext", ["-f", "1", "-l", "1", "-layout", "-", "-"], {
    input: Buffer.from(await pdfResponse.arrayBuffer()),
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
}

async function main() {
  const files = (await readdir(path.join(root, "src", "data")))
    .filter((file) => file.startsWith("archive-") && file.endsWith(".json"));
  let updated = 0;

  for (const file of files) {
    const manifestPath = path.join(root, "src", "data", file);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const candidates = manifest.filter((exam) => subjects.has(exam.subject) && exam.profile === "General");
    for (const exam of candidates) {
      const archiveId = exam.id.match(/-(\d+)$/)?.[1];
      if (!archiveId) throw new Error(`Invalid archive id ${exam.id}`);
      const profile = classify(exam.subject, await readFirstPage(archiveId));
      if (!profile) throw new Error(`Could not identify the variant for ${exam.id}`);
      exam.profile = profile;
      updated += 1;
      console.log(`${exam.id}: ${profile}`);
    }
    if (candidates.length > 0) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(`Classified ${updated} legacy papers from their first-page headers.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
