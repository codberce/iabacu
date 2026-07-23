import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const manifestPath = path.join(root, "src", "data", "olympiad.json");
const cataloguePath = path.join(root, "scripts", "olympiad-local-sources.json");
const tempRoot = path.join(root, "tmp", "olympiad-local-import");
const apply = process.argv.includes("--apply");
const sourceFilter = argumentValue("--source");
const onlyFilter = argumentValue("--only");

function argumentValue(name) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
}

function normalize(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function slugify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function inferGrade(value) {
  const title = normalize(value);
  const numeric = [
    ...title.matchAll(/(?:^|[^0-9])(0?[5-9]|1[0-2])(?=(?:sb|sub|bar|barem)|[^0-9]|$)/g),
  ].map((match) => Number(match[1]));
  const romanMap = { v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
  const roman = [
    ...title.matchAll(/(?:^|[^a-z0-9])(xii|viii|vii|vi|xi|ix|v|x)(?=[^a-z0-9]|$)/g),
  ].map((match) => romanMap[match[1]]);
  const matches = [...new Set([...numeric, ...roman])];
  return matches.length === 1 ? matches[0] : undefined;
}

function inferKind(value) {
  const title = normalize(value);
  const subject = /(?:^|[^a-z])(?:sb|sub|subiect|subiecte|enunt|enunturi)(?=[^a-z]|$)/.test(title);
  const solution = /(?:^|[^a-z])(?:bar|barem|bareme|sol|solutie|solutii|rezolvare|rezolvari|raspuns|raspunsuri)(?=[^a-z]|$)/.test(title);
  if (subject && !solution) return "subject";
  if (solution && !subject) return "solution";
  return "combined";
}

async function download(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "iabacu-olympiad-import/2.0" },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
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

const countyAliases = {
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

function countyFromTitle(title) {
  const match = title.match(/jude(?:ț|t)ul\s+(.+)$/i);
  if (!match) return undefined;
  const key = slugify(match[1]).replaceAll("-", "");
  return countyAliases[key] ?? match[1];
}

function countyFromPath(value) {
  const key = slugify(value).replaceAll("-", "");
  return countyAliases[key] ?? value.replaceAll(/[_-]+/g, " ");
}

function parseMaterialLinks(html, year) {
  const links = [];
  const seen = new Set();
  const pattern = /<a class="row-title" href="([^"]+)">\s*([\s\S]*?)\s*<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!new RegExp(`Olimpiada de Matematică ${year},`, "i").test(title)) continue;
    if (!/Etapa Locală/i.test(title) || !/(?:Clasa a|Clasele?)\s+(?:IX|X|XI|XII|9|10|11|12)/i.test(title)) continue;
    const pageUrl = new URL(match[1], "https://www.olimpiade.ro/").toString();
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);
    links.push({ pageUrl, title });
  }
  return links;
}

async function parseOlimpiadeRoMaterials(source) {
  const firstUrl = new URL(source.url);
  const firstHtml = (await download(firstUrl)).toString("utf8");
  const maxPage = Math.max(1, ...[...firstHtml.matchAll(/[?&]page=(\d+)/g)].map((match) => Number(match[1])));
  const pages = [firstHtml];
  for (let page = 2; page <= maxPage; page += 1) {
    const url = new URL(firstUrl);
    url.searchParams.set("page", String(page));
    pages.push((await download(url)).toString("utf8"));
  }
  const materialLinks = [...new Map(
    pages.flatMap((html) => parseMaterialLinks(html, source.year)).map((item) => [item.pageUrl, item]),
  ).values()];
  const sources = [];
  for (const material of materialLinks) {
    const html = (await download(material.pageUrl)).toString("utf8");
    const fileMatch = html.match(/href="(\/\/static\.olimpiade\.ro\/[^" ]+\.pdf)"/i);
    if (!fileMatch) continue;
    const kind = /barem/i.test(material.title) ? "solution" : "subject";
    sources.push({
      id: `${source.id}-${slugify(material.title)}-${sources.length}`,
      type: "pdf",
      stage: "locala",
      year: source.year,
      grade: inferGrade(material.title),
      kind,
      county: countyFromTitle(material.title),
      title: material.title,
      url: new URL(fileMatch[1], "https://www.olimpiade.ro/").toString(),
      catalogueUrl: material.pageUrl,
      provenance: source.provenance,
    });
  }
  return sources;
}

function parseMateInfoArchives(html, source) {
  const archives = new Map();
  const pattern = /(?:https?:\/\/mate\.info\.ro)?\/OLM\/OLM(\d{4})\/([^"'<>\s]+\.(?:zip|rar))/gi;
  for (const match of html.matchAll(pattern)) {
    const year = Number(match[1]);
    const filename = decodeURIComponent(match[2]);
    const county = countyFromPath(path.basename(filename, path.extname(filename)));
    const url = new URL(`/OLM/OLM${year}/${match[2]}`, source.url).toString();
    const id = `${source.id}-${year}-${slugify(county)}`;
    if (!archives.has(url)) archives.set(url, {
      id, type: "archive", stage: source.stage, year, county, url,
      catalogueSourceId: source.id, catalogueUrl: source.url, provenance: source.provenance,
    });
  }
  return [...archives.values()];
}

async function expandSources(sources) {
  const expanded = [];
  for (const source of sources) {
    if (source.type !== "catalogue") { expanded.push(source); continue; }
    let discovered;
    if (source.parser === "mate-info-olm-archives") {
      discovered = parseMateInfoArchives((await download(source.url)).toString("utf8"), source);
    } else if (source.parser === "olimpiade-ro-materials") {
      discovered = await parseOlimpiadeRoMaterials(source);
    } else {
      throw new Error(`Parser necunoscut: ${source.parser}`);
    }
    if (discovered.length === 0) throw new Error("Catalogul nu conține surse detectabile.");
    expanded.push(...discovered);
  }
  return expanded;
}

function extractArchive(archivePath, destination) {
  execFileSync("7z", ["t", archivePath], { stdio: "ignore" });
  execFileSync("7z", ["x", "-y", `-o${destination}`, archivePath], { stdio: "ignore" });
}

function sanitizeExtractedFilenames(directory) {
  const script = String.raw`
    use File::Basename qw(dirname basename);
    use File::Find;
    find({ no_chdir => 1, wanted => sub {
      return unless -f $File::Find::name;
      my $directory = dirname($File::Find::name);
      my $filename = basename($File::Find::name);
      my $sanitized = $filename;
      $sanitized =~ s/[^\x20-\x7e]/_/g;
      rename($File::Find::name, "$directory/$sanitized") if $sanitized ne $filename;
    } }, $ARGV[0]);
  `;
  execFileSync("perl", ["-e", script, directory], { stdio: "ignore" });
}

async function extractNestedArchives(directory) {
  const seen = new Set();
  const errors = [];
  for (let depth = 0; depth < 5; depth += 1) {
    const archives = (await walk(directory)).filter((file) =>
      /\.(?:zip|rar|7z)$/i.test(file) && !path.basename(file).startsWith("._") &&
      !file.split(path.sep).includes("__MACOSX") && !seen.has(file));
    if (archives.length === 0) break;
    for (const archive of archives) {
      seen.add(archive);
      try { await mkdir(`${archive}.contents`, { recursive: true }); extractArchive(archive, `${archive}.contents`); }
      catch (error) { errors.push(`${path.basename(archive)}: ${String(error?.message ?? error)}`); }
    }
  }
  return errors;
}

async function convertOfficeDocuments(directory, profileDirectory) {
  const officeFiles = (await walk(directory)).filter((file) =>
    /\.(?:doc|docx|odt|rtf)$/i.test(file) && !path.basename(file).startsWith("~$") &&
    !file.split(path.sep).includes("__MACOSX"));
  const errors = [];
  await mkdir(profileDirectory, { recursive: true });
  for (const file of officeFiles) {
    try {
      execFileSync("libreoffice", [
        `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`, "--headless",
        "--convert-to", "pdf", "--outdir", path.dirname(file), file,
      ], { stdio: "ignore", timeout: 60_000 });
    } catch (error) { errors.push(`${path.basename(file)}: ${String(error?.message ?? error)}`); }
  }
  return errors;
}

async function archivePdfs(source, buffer, workRoot) {
  const extension = path.extname(new URL(source.url).pathname) || ".archive";
  const archivePath = path.join(workRoot, `source${extension}`);
  const extractPath = path.join(workRoot, "files");
  await mkdir(extractPath, { recursive: true });
  await writeFile(archivePath, buffer);
  extractArchive(archivePath, extractPath);
  sanitizeExtractedFilenames(extractPath);
  const nestedErrors = await extractNestedArchives(extractPath);
  sanitizeExtractedFilenames(extractPath);
  const conversionErrors = await convertOfficeDocuments(extractPath, path.join(workRoot, "libreoffice-profile"));
  const pdfs = (await walk(extractPath)).filter((file) => file.toLowerCase().endsWith(".pdf"));
  return { pdfs, errors: [...nestedErrors, ...conversionErrors] };
}

function documentFor({ source, buffer, title, grade, kind }) {
  if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("Sursa nu este un PDF valid.");
  const digest = sha256(buffer);
  const effectiveGrade = grade ?? source.grade;
  const effectiveKind = source.kind ?? kind;
  const effectiveTitle = source.title ?? title;
  const id = ["locala", source.year, source.county && slugify(source.county), effectiveGrade && `clasa-${effectiveGrade}`, slugify(effectiveTitle), digest.slice(0, 8)]
    .filter(Boolean).join("-");
  const relativePath = path.posix.join("olimpiada-matematica", "locala", String(source.year), source.county ? slugify(source.county) : "fara-judet", `${id}.pdf`);
  return {
    id,
    stage: "locala",
    year: source.year,
    ...(source.county ? { county: source.county } : {}),
    ...(effectiveGrade ? { grade: effectiveGrade } : {}),
    kind: effectiveKind,
    title: effectiveTitle,
    pdfPath: `/${relativePath}`,
    sourceUrl: source.url,
    ...(source.catalogueUrl ? { catalogueUrl: source.catalogueUrl } : {}),
    ...(source.id ? { sourceId: source.id } : {}),
    ...(source.type ? { sourceType: source.type } : {}),
    ...(source.catalogueSourceId ? { catalogueSourceId: source.catalogueSourceId } : {}),
    provenance: source.provenance,
    sha256: digest,
    size: buffer.length,
  };
}

function documentKey(document) {
  return [document.sha256, document.stage, document.year, document.county ?? "", document.grade ?? "", document.kind].join(":");
}

async function processSource(source, keys, index) {
  const outcome = { sourceId: source.id, sourceUrl: source.url, type: source.type, status: "failed", documents: 0 };
  const workRoot = path.join(tempRoot, `${String(index).padStart(4, "0")}-${slugify(source.id)}`);
  try {
    if (!source.year || !source.stage) throw new Error("Sursa directă trebuie să specifice anul și etapa.");
    const buffer = await download(source.url);
    const candidates = buffer.subarray(0, 5).toString() === "%PDF-"
      ? [{ buffer, title: path.basename(new URL(source.url).pathname, path.extname(new URL(source.url).pathname)) }]
      : await Promise.all((await archivePdfs(source, buffer, workRoot)).pdfs.map(async (file) => ({
          buffer: await readFile(file),
          title: path.basename(file, path.extname(file)).replaceAll("_", " "),
          relativeTitle: path.relative(path.join(workRoot, "files"), file),
        })));
    const documents = [];
    for (const candidate of candidates) {
      if (candidate.buffer.subarray(0, 5).toString() !== "%PDF-") continue;
      const document = documentFor({
        source,
        buffer: candidate.buffer,
        title: candidate.title,
        grade: inferGrade(candidate.relativeTitle ?? candidate.title),
        kind: inferKind(candidate.relativeTitle ?? candidate.title),
      });
      const key = documentKey(document);
      if (keys.has(key)) continue;
      keys.add(key);
      documents.push({ document, buffer: candidate.buffer });
    }
    outcome.status = documents.length ? "imported" : "skipped";
    outcome.documents = documents.length;
    outcome.reason = documents.length ? undefined : "Nu există PDF-uri noi valide în sursă.";
    return { outcome, documents };
  } catch (error) {
    outcome.reason = String(error instanceof Error ? error.message : error);
    return { outcome, documents: [] };
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
}

function matchesOnly(source) {
  if (!onlyFilter) return true;
  if (source.id === onlyFilter) return true;
  const [year, county] = onlyFilter.split(":");
  return String(source.year) === year && slugify(source.county ?? "") === slugify(county ?? "");
}

const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
let selected = catalogue.sources;
if (sourceFilter) selected = selected.filter((source) =>
  source.id === sourceFilter || source.id.startsWith(`${sourceFilter}-`),
);
if (selected.length === 0) throw new Error("Filtrul --source nu corespunde unei surse din catalog.");

if (!apply) {
  console.log("Dry run: nu se face trafic de rețea și nu se modifică fișiere.");
  for (const source of selected) {
    console.log(JSON.stringify({ sourceId: source.id, sourceUrl: source.url, type: source.type, status: "planned", reason: "Rulează cu --apply pentru descărcare și import." }));
  }
  process.exit(0);
}

await mkdir(tempRoot, { recursive: true });
try {
  const sources = (await expandSources(selected)).filter(matchesOnly);
  if (sources.length === 0) throw new Error("Filtrul --only nu corespunde unei surse directe detectate.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const keys = new Set(manifest.documents.map(documentKey));
  const results = [];
  for (const [index, source] of sources.entries()) results.push(await processSource(source, keys, index));
  const additions = results.flatMap((result) => result.documents);
  const writtenPaths = [];
  try {
    for (const { document, buffer } of additions) {
      const destination = path.join(root, "public", document.pdfPath.replace(/^\//, ""));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, buffer, { flag: "wx" });
      writtenPaths.push(destination);
    }
  } catch (error) {
    await Promise.all(writtenPaths.map((file) => rm(file, { force: true })));
    throw error;
  }
  const outcomes = results.map((result) => result.outcome);
  const gaps = outcomes.filter((outcome) => outcome.status === "failed").map((outcome) => ({
    stage: "locala", sourceUrl: outcome.sourceUrl, sourceId: outcome.sourceId, reason: outcome.reason,
  }));
  const retainedGaps = (manifest.gaps ?? []).filter((gap) => !outcomes.some((outcome) => outcome.sourceUrl === gap.sourceUrl));
  const documents = [...manifest.documents, ...additions.map(({ document }) => document)].toSorted((a, b) => b.year - a.year || (a.county ?? "").localeCompare(b.county ?? "", "ro") || a.id.localeCompare(b.id));
  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, generatedAt: new Date().toISOString(), documents, gaps: [...retainedGaps, ...gaps] }, null, 2)}\n`);
  for (const outcome of outcomes) console.log(JSON.stringify(outcome));
  console.log(`Import finalizat: ${additions.length} PDF-uri noi din ${sources.length} surse.`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
