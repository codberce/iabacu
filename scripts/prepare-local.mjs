import fs from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDirectory = path.join(root, ".next");
const buildIdPath = path.join(buildDirectory, "BUILD_ID");
const fingerprintPath = path.join(buildDirectory, ".iabacu-source-hash");
const inputs = [
  "src",
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  "package.json",
  "pnpm-lock.yaml",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
];

async function addPath(hash, relativePath) {
  const absolutePath = path.join(root, relativePath);
  let details;
  try {
    details = await stat(absolutePath);
  } catch {
    return;
  }
  if (details.isDirectory()) {
    const entries = (await readdir(absolutePath)).sort();
    for (const entry of entries) await addPath(hash, path.join(relativePath, entry));
    return;
  }
  if (!details.isFile()) return;
  hash.update(relativePath.replaceAll(path.sep, "/"));
  hash.update("\0");
  for await (const chunk of fs.createReadStream(absolutePath)) hash.update(chunk);
  hash.update("\0");
}

const hash = createHash("sha256");
for (const input of inputs) await addPath(hash, input);
const fingerprint = hash.digest("hex");

let previousFingerprint = "";
try {
  previousFingerprint = (await readFile(fingerprintPath, "utf8")).trim();
  await stat(buildIdPath);
} catch {
  previousFingerprint = "";
}

if (previousFingerprint === fingerprint) {
  console.log("Aplicația este deja pregătită.");
  process.exit(0);
}

console.log("Se pregătește aplicația pentru prima pornire…");
const nextBinary = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);
const result = spawnSync(nextBinary, ["build"], {
  cwd: root,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  shell: process.platform === "win32",
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

await mkdir(buildDirectory, { recursive: true });
await writeFile(fingerprintPath, `${fingerprint}\n`);
console.log("Aplicația este pregătită.");
