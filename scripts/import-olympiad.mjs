import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicRoot = path.join(root, "public", "olimpiada-matematica");
const manifestPath = path.join(root, "src", "data", "olympiad.json");
const tempRoot = path.join(root, "tmp", "olympiad-import");
const grades = [5, 6, 7, 8, 9, 10, 11, 12];

const countyNames = {
  alba: "Alba", arad: "Arad", arges: "Argeș", bacau: "Bacău",
  bihor: "Bihor", bistritanasaud: "Bistrița-Năsăud", botosani: "Botoșani",
  brasov: "Brașov", braila: "Brăila", bucuresti: "București", buzau: "Buzău",
  carasseverin: "Caraș-Severin", calarasi: "Călărași", cluj: "Cluj",
  constanta: "Constanța", covasna: "Covasna", dambovita: "Dâmbovița",
  dolj: "Dolj", galati: "Galați", giurgiu: "Giurgiu", gorj: "Gorj",
  harghita: "Harghita", hunedoara: "Hunedoara", ialomita: "Ialomița",
  iasi: "Iași", ilfov: "Ilfov", maramures: "Maramureș", mehedinti: "Mehedinți",
  mures: "Mureș", neamt: "Neamț", olt: "Olt", prahova: "Prahova",
  satumare: "Satu Mare", salaj: "Sălaj", sibiu: "Sibiu", suceava: "Suceava",
  teleorman: "Teleorman", timis: "Timiș", tulcea: "Tulcea", vaslui: "Vaslui",
  valcea: "Vâlcea", vrancea: "Vrancea",
};

const nationalSources = [];
for (const year of [2013, 2014]) {
  for (const grade of grades) {
    nationalSources.push({ year, grade, kind: "combined", url: `https://ssmr.ro/files/onm${year}/faza_nationala/subiecte/solutii_${grade}.pdf` });
  }
}
for (const year of [2016, 2017, 2018, 2019]) {
  const romans = { 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII" };
  for (const grade of grades) {
    nationalSources.push({ year, grade, kind: "combined", url: `https://ssmr.ro/files/onm${year}/subiecte/ONM_${year}_Clasa_${romans[grade]}.pdf` });
  }
}
for (const grade of [7, 8, 9, 10, 11, 12]) {
  nationalSources.push(
    { year: 2021, grade, kind: "subject", url: `https://ssmr.ro/files/onm2021/etapa_3/subiecte/Subiecte_cl_${grade}.pdf` },
    { year: 2021, grade, kind: "solution", url: `https://ssmr.ro/files/onm2021/etapa_3/subiecte/Barem_solutii_${grade}.pdf` },
  );
}
for (const grade of grades) {
  nationalSources.push({ year: 2022, grade, kind: "combined", url: `https://ssmr.ro/files/onm2022/finala/cl${grade}_nationala.pdf` });
}
for (const year of [2023, 2024, 2025, 2026]) {
  for (const grade of grades) {
    nationalSources.push({ year, grade, kind: "combined", url: `https://ssmr.ro/files/onm${year}/faza_nationala/${String(grade).padStart(2, "0")}_solutii_bareme_ONM_${year}.pdf` });
  }
}

const countyStageSources = [];
for (const grade of grades) {
  countyStageSources.push({ year: 2013, grade, kind: "combined", url: `https://ssmr.ro/files/onm2013/faza_judet/solutii/clasa_${grade}_2013_sol.pdf` });
}
for (const year of [2014, 2015, 2016, 2017, 2018, 2019, 2023, 2024, 2025, 2026]) {
  for (const grade of grades) {
    countyStageSources.push({ year, grade, kind: "combined", url: `https://ssmr.ro/files/onm${year}/faza_municipiu/barem_clasa${grade}.pdf` });
  }
}
for (const grade of grades) {
  countyStageSources.push({ year: 2021, grade, kind: "subject", url: `https://ssmr.ro/files/onm2021/etapa_2/cl_${grade}_enunturi.pdf` });
  if (grade >= 9) countyStageSources.push({ year: 2021, grade, kind: "solution", url: `https://ssmr.ro/files/onm2021/etapa_2/cl_${grade}_raspunsuri.pdf` });
  countyStageSources.push({ year: 2022, grade, kind: "combined", url: `https://ssmr.ro/files/onm2022/judet/${String(grade).padStart(2, "0")}_solutii_bareme_OJM_2022.pdf` });
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function countyName(value) {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return countyNames[key] ?? value.replaceAll("_", " ");
}

async function download(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function savePdf({ stage, year, grade, kind, county, title, sourceUrl, buffer }) {
  if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("not a PDF");
  const digest = sha256(buffer);
  const id = [stage, year, county && slugify(county), grade && `clasa-${grade}`, slugify(title ?? kind), digest.slice(0, 8)].filter(Boolean).join("-");
  const relative = path.posix.join("olimpiada-matematica", stage, String(year), county ? slugify(county) : "", `${id}.pdf`);
  const destination = path.join(root, "public", relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, buffer);
  return {
    id, stage, year, ...(county ? { county } : {}), ...(grade ? { grade } : {}),
    kind, title: title ?? `Clasa a ${grade}-a`, pdfPath: `/${relative}`,
    sourceUrl, sha256: digest, size: buffer.length,
  };
}

async function importDirectSources(stage, sources, documents, gaps) {
  for (const source of sources) {
    const title = source.kind === "subject" ? `Clasa a ${source.grade}-a - subiect` : source.kind === "solution" ? `Clasa a ${source.grade}-a - soluții` : `Clasa a ${source.grade}-a - subiecte și soluții`;
    try {
      const buffer = await download(source.url);
      documents.push(await savePdf({ stage, ...source, title, sourceUrl: source.url, buffer }));
      console.log(`ok ${stage} ${source.year} ${source.grade} ${source.kind}`);
    } catch (error) {
      gaps.push({ stage, year: source.year, grade: source.grade, sourceUrl: source.url, reason: String(error.message ?? error) });
      console.warn(`skip ${stage} ${source.year} ${source.grade}: ${error.message}`);
    }
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(item));
    else files.push(item);
  }
  return files;
}

async function importLocalArchives(documents, gaps) {
  const pages = [
    [2023, "https://mateinfo.ro/subiecte-olimpiada-matematica/olimpiada-de-matematica-gimnaziu-si-liceu-etapa-locala-din-toate-judetele/olm-locala-2023-gimnaziu-si-liceu-subiecte-si-solutii-etapa-locala"],
    [2024, "https://mateinfo.ro/subiecte-olimpiada-matematica/olimpiada-de-matematica-gimnaziu-si-liceu-etapa-locala-din-toate-judetele/olm-locala-2024-gimnaziu-si-liceu-subiecte-si-solutii-etapa-locala"],
    [2025, "https://mateinfo.ro/subiecte-olimpiada-matematica/olimpiada-de-matematica-gimnaziu-si-liceu-etapa-locala-din-toate-judetele/olm-locala-2025-gimnaziu-si-liceu-subiecte-si-solutii-etapa-locala"],
  ];

  for (const [year, baseUrl] of pages) {
    const pageUrls = [baseUrl, `${baseUrl}?limit=20&limitstart=20`, `${baseUrl}?limit=20&limitstart=40`];
    const archives = new Map();
    for (const pageUrl of pageUrls) {
      try {
        const html = (await download(pageUrl)).toString();
        const pattern = /<a\s+href="([^"]+\/file)"\s+title="([^"]+\.zip)"/gi;
        for (const match of html.matchAll(pattern)) {
          archives.set(match[2], {
            county: countyName(path.basename(match[2], ".zip")),
            sourceUrl: new URL(match[1], pageUrl).toString(),
          });
        }
      } catch {}
    }

    if (year === 2025) {
      archives.set("Timis-gimnaziu.zip", {
        county: "Timiș",
        sourceUrl: "https://www.isj.tm.edu.ro/public/data_files/specializari/fisier-6551.zip",
      });
      archives.set("Timis-liceu.zip", {
        county: "Timiș",
        sourceUrl: "https://www.isj.tm.edu.ro/public/data_files/specializari/fisier-6555.zip",
      });
    }

    for (const archiveSource of archives.values()) {
      const { county, sourceUrl } = archiveSource;
      const archivePath = path.join(tempRoot, `${year}-${slugify(county)}.zip`);
      const extractPath = path.join(tempRoot, `${year}-${slugify(county)}`);
      try {
        const archive = await download(sourceUrl);
        await writeFile(archivePath, archive);
        execFileSync("7z", ["t", archivePath], { stdio: "ignore" });
        await rm(extractPath, { recursive: true, force: true });
        await mkdir(extractPath, { recursive: true });
        execFileSync("7z", ["x", "-y", `-o${extractPath}`, archivePath], { stdio: "ignore" });
        const pdfs = (await walk(extractPath)).filter((file) => file.toLowerCase().endsWith(".pdf"));
        let savedCount = 0;
        for (const pdf of pdfs) {
          const title = path.basename(pdf, path.extname(pdf)).replaceAll("_", " ");
          const gradeMatch = title.match(/(?:clasa|cls|cl)[ ._-]*(?:a[ ._-]*)?(5|6|7|8|9|10|11|12)\b/i);
          try {
            documents.push(await savePdf({ stage: "locala", year, county, grade: gradeMatch ? Number(gradeMatch[1]) : undefined, kind: /barem|solu/i.test(title) ? "solution" : "combined", title, sourceUrl, buffer: await readFile(pdf) }));
            savedCount += 1;
          } catch (error) {
            console.warn(`skip fișier ${year} ${county} ${path.basename(pdf)}: ${error.message}`);
          }
        }
        if (savedCount === 0) throw new Error("arhiva nu conține PDF-uri valide");
        console.log(`ok locala ${year} ${county}: ${savedCount} PDF-uri`);
      } catch (error) {
        gaps.push({ stage: "locala", year, county, sourceUrl, reason: String(error.message ?? error) });
        console.warn(`skip locala ${year} ${county}: ${error.message}`);
      } finally {
        await rm(archivePath, { force: true });
        await rm(extractPath, { recursive: true, force: true });
      }
    }
  }
}

let storageConfig = {};
try {
  const existingManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (existingManifest.assetStorage) {
    storageConfig.assetStorage = existingManifest.assetStorage;
  }
  if (existingManifest.assetBaseUrl) {
    storageConfig.assetBaseUrl = existingManifest.assetBaseUrl;
  }
} catch {}

await rm(publicRoot, { recursive: true, force: true });
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

const documents = [];
const gaps = [];
await importDirectSources("nationala", nationalSources, documents, gaps);
await importDirectSources("judeteana", countyStageSources, documents, gaps);
await importLocalArchives(documents, gaps);

documents.sort((a, b) => b.year - a.year || (a.county ?? "").localeCompare(b.county ?? "", "ro") || (a.grade ?? 0) - (b.grade ?? 0));
await writeFile(manifestPath, `${JSON.stringify({ ...storageConfig, generatedAt: new Date().toISOString(), documents, gaps }, null, 2)}\n`);
await rm(tempRoot, { recursive: true, force: true });
console.log(`Imported ${documents.length} PDFs; ${gaps.length} source gaps.`);
