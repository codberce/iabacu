import fs from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import http from "node:http";
import https from "node:https";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "scripts", "offline-assets.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const { version, repository, archives } = manifest;
const releaseBase = (process.env.IABACU_ASSET_URL ??
  `https://github.com/${repository}/releases/download/${version}`).replace(/\/$/, "");
const cacheDirectory = path.join(root, ".asset-downloads");
const publicDirectory = path.join(root, "public");
const markerPath = path.join(publicDirectory, ".offline-assets-version");
const stateDirectory = path.join(publicDirectory, ".offline-assets-state");
const stateVersionPath = path.join(stateDirectory, "version");
const verificationReportPath = path.join(cacheDirectory, "verification.json");

function request(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith("https:") ? https : http;
    transport.get(url, { headers }, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        if (redirects >= 10) return reject(new Error("Prea multe redirecționări."));
        return resolve(request(
          new URL(response.headers.location, url).toString(),
          headers,
          redirects + 1,
        ));
      }
      if (response.statusCode !== 200 && response.statusCode !== 206) {
        response.resume();
        return reject(new Error(`Descărcarea a eșuat (${response.statusCode}).`));
      }
      resolve(response);
    }).on("error", reject);
  });
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function validArchive(filePath, archive) {
  try {
    const details = await stat(filePath);
    return details.size === archive.size && await hashFile(filePath) === archive.sha256;
  } catch {
    return false;
  }
}

async function download(archive) {
  const { name, sha256, size } = archive;
  const target = path.join(cacheDirectory, name);
  const partial = `${target}.part`;

  if (await validArchive(target, archive)) return target;
  await rm(target, { force: true });

  let offset = 0;
  try {
    offset = (await stat(partial)).size;
    if (offset > size) {
      await rm(partial, { force: true });
      offset = 0;
    }
  } catch {
    // No partial download yet.
  }

  if (offset === size) {
    if (await validArchive(partial, archive)) {
      await rename(partial, target);
      return target;
    }
    await rm(partial, { force: true });
    offset = 0;
  }

  let hash = createHash("sha256");
  if (offset > 0) {
    for await (const chunk of fs.createReadStream(partial)) hash.update(chunk);
  }

  const response = await request(
    `${releaseBase}/${name}`,
    offset > 0 ? { Range: `bytes=${offset}-` } : {},
  );
  const contentRange = response.headers["content-range"] ?? "";
  const resumed = offset > 0 &&
    response.statusCode === 206 &&
    contentRange.startsWith(`bytes ${offset}-`);

  if (offset > 0 && !resumed) {
    offset = 0;
    hash = createHash("sha256");
  }

  let received = offset;
  let lastPercent = Math.floor((received / size) * 100) - 5;
  const progress = new Transform({
    transform(chunk, encoding, callback) {
      void encoding;
      received += chunk.byteLength;
      hash.update(chunk);
      const percent = Math.min(100, Math.floor((received / size) * 100));
      if (percent >= lastPercent + 5) {
        process.stdout.write(`\r${name}: ${percent}%`);
        lastPercent = percent;
      }
      callback(null, chunk);
    },
  });

  await pipeline(
    response,
    progress,
    fs.createWriteStream(partial, { flags: resumed ? "a" : "w" }),
  );
  process.stdout.write("\n");

  const downloadedSize = (await stat(partial)).size;
  if (downloadedSize !== size || hash.digest("hex") !== sha256) {
    await rm(partial, { force: true });
    throw new Error(`Verificarea ${name} a eșuat. Încearcă din nou.`);
  }

  await rename(partial, target);
  return target;
}

function extract(archivePath) {
  const result = spawnSync(
    "tar",
    ["-xzf", archivePath, "-C", publicDirectory],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`Arhiva ${path.basename(archivePath)} nu a putut fi extrasă.`);
  }
}

async function verify(writeReport = false) {
  const args = [path.join(root, "scripts", "verify-local-assets.mjs")];
  if (writeReport) args.push("--json", verificationReportPath);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  return result.status === 0;
}

function archiveNameFor(relativePath) {
  if (relativePath.startsWith("archive/")) return "iabacu-archive.tar.gz";
  if (relativePath.startsWith("exams/")) return "iabacu-exams.tar.gz";
  if (relativePath.startsWith("olympiad/text/")) return "iabacu-olympiad-text.tar.gz";
  const hash = relativePath.match(/^olympiad\/pdf\/([0-9a-f])/i)?.[1]?.toLowerCase();
  if (!hash) return undefined;
  if (hash <= "3") return "iabacu-olympiad-pdf-0-3.tar.gz";
  if (hash <= "7") return "iabacu-olympiad-pdf-4-7.tar.gz";
  if (hash <= "b") return "iabacu-olympiad-pdf-8-b.tar.gz";
  return "iabacu-olympiad-pdf-c-f.tar.gz";
}

function partMarker(archive) {
  return path.join(stateDirectory, `${archive.name}.complete`);
}

async function partIsComplete(archive) {
  try {
    return (await readFile(partMarker(archive), "utf8")).trim() === archive.sha256;
  } catch {
    return false;
  }
}

async function prepareState() {
  let stateVersion = "";
  try {
    stateVersion = (await readFile(stateVersionPath, "utf8")).trim();
  } catch {
    // A fresh or legacy installation has no state directory.
  }
  if (stateVersion !== version) {
    await rm(stateDirectory, { recursive: true, force: true });
    await mkdir(stateDirectory, { recursive: true });
    await writeFile(stateVersionPath, `${version}\n`);
  }
}

async function markMissingPartsForRepair() {
  let report;
  try {
    report = JSON.parse(await readFile(verificationReportPath, "utf8"));
  } catch {
    report = { missing: [] };
  }
  const affectedNames = new Set(report.missing.map(archiveNameFor).filter(Boolean));
  const partsToRepair = affectedNames.size > 0
    ? archives.filter((archive) => affectedNames.has(archive.name))
    : archives;
  for (const archive of partsToRepair) {
    await rm(partMarker(archive), { force: true });
  }
  await rm(markerPath, { force: true });
  console.log(`Se repară ${partsToRepair.length} părți ale arhivei locale.`);
}

await mkdir(cacheDirectory, { recursive: true });
await mkdir(publicDirectory, { recursive: true });
await prepareState();

let installedVersion = "";
try {
  installedVersion = (await readFile(markerPath, "utf8")).trim();
} catch {
  // No complete installation marker yet.
}

if (installedVersion === version) {
  if (await verify(true)) {
    for (const archive of archives) {
      if (!await partIsComplete(archive)) {
        await writeFile(partMarker(archive), `${archive.sha256}\n`);
      }
    }
    await rm(cacheDirectory, { recursive: true, force: true });
    process.exit(0);
  }
  await markMissingPartsForRepair();
} else if (installedVersion) {
  await rm(stateDirectory, { recursive: true, force: true });
  await mkdir(stateDirectory, { recursive: true });
  await writeFile(stateVersionPath, `${version}\n`);
  await rm(markerPath, { force: true });
}

console.log("Se pregătește arhiva completă (aproximativ 4,5 GB descărcați). Descărcările întrerupte sunt reluate automat.");
for (const archive of archives) {
  if (await partIsComplete(archive)) continue;
  const archivePath = await download(archive);
  extract(archivePath);
  await writeFile(partMarker(archive), `${archive.sha256}\n`);
  await rm(archivePath, { force: true });
}

if (!await verify()) throw new Error("Arhiva locală este incompletă.");
await writeFile(markerPath, `${version}\n`);
await rm(cacheDirectory, { recursive: true, force: true });
console.log("Arhiva este pregătită.");
