#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = join(root, "src");
const appRoot = join(sourceRoot, "app");
const reportPath = process.argv.find((arg) => arg.startsWith("--json="))?.slice("--json=".length);

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

function routePattern(file) {
  const parts = relative(appRoot, file).split("/");
  parts.pop();
  const route = `/${parts.map((part) => {
    if (/^\[\.\.\..+\]$/.test(part)) return ".+";
    if (/^\[.+\]$/.test(part)) return "[^/]+";
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("/")}`.replace(/\/$/, "") || "/";
  return new RegExp(`^${route}/?$`);
}

const routePatterns = filesIn(appRoot)
  .filter((file) => /\/page\.tsx$/.test(file))
  .map(routePattern);
const links = [];
for (const file of filesIn(sourceRoot).filter((path) => /\.(?:tsx|ts)$/.test(path))) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bhref\s*=\s*["'](\/[^"'#?]*)["']/g)) {
    links.push({ file: relative(root, file), href: match[1] });
  }
}

const invalid = links.filter(({ href }) => {
  if (href.startsWith("/api/") || href.startsWith("/_next/")) return false;
  return !routePatterns.some((pattern) => pattern.test(href));
});
const report = {
  checkedAt: new Date().toISOString(),
  routeCount: routePatterns.length,
  checkedLinks: links.length,
  invalid,
};
if (reportPath) writeFileSync(resolve(root, reportPath), `${JSON.stringify(report, null, 2)}\n`);
if (invalid.length) {
  console.error("Invalid internal links:");
  for (const link of invalid) console.error(`- ${link.file}: ${link.href}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${links.length} internal links against ${routePatterns.length} routes.`);
}
