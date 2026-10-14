import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { examAliases, exams } from "../src/lib/exams";

const file = path.resolve("src/data/exam-route-ids.json");
const ids = [...new Set([...exams.map((exam) => exam.id), ...Object.keys(examAliases)])].toSorted();
const output = `${JSON.stringify(ids)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(file, "utf8") !== output) {
    throw new Error("Exam route index is stale; run pnpm build:exam-route-index.");
  }
} else {
  writeFileSync(`${file}.tmp`, output);
  renameSync(`${file}.tmp`, file);
}
console.log(`Exam route index: ${ids.length} public document IDs.`);
