import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExtractedExamContext } from "@/lib/grading";

const contextPrefix = "src/data/exam-text/";
const archiveContextPattern = /^archive\/archive-[a-z0-9-]+-(\d+)\.json$/;
const archiveContextCache = new Map<string, Promise<ExtractedExamContext>>();

async function extractPdfText(filePath: string): Promise<string> {
  const bytes = new Uint8Array(await readFile(filePath));
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" "),
      );
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages.join("\n\n--- page ---\n\n").trim();
}

async function loadArchiveContext(
  examId: string,
  archiveExamId: string,
): Promise<ExtractedExamContext> {
  const archiveDirectory = path.join(process.cwd(), "public", "archive");
  const [subjectText, baremText] = await Promise.all([
    extractPdfText(path.join(archiveDirectory, `${archiveExamId}-subject.pdf`)),
    extractPdfText(path.join(archiveDirectory, `${archiveExamId}-barem.pdf`)),
  ]);
  if (!subjectText || !baremText) {
    throw new Error("Textul subiectului sau al baremului nu a putut fi extras.");
  }
  return { examId, subjectText, baremText };
}

export async function loadExamContext(
  contextPath: string,
): Promise<ExtractedExamContext> {
  if (!contextPath.startsWith(contextPrefix)) {
    throw new Error("Cale context invalidă.");
  }
  const relativePath = contextPath.slice(contextPrefix.length);
  if (relativePath.split("/").includes("..")) {
    throw new Error("Cale context invalidă.");
  }

  const archiveMatch = relativePath.match(archiveContextPattern);
  if (archiveMatch) {
    const examId = relativePath.slice("archive/".length, -".json".length);
    let context = archiveContextCache.get(examId);
    if (!context) {
      context = loadArchiveContext(examId, archiveMatch[1]);
      archiveContextCache.set(examId, context);
      context.catch(() => archiveContextCache.delete(examId));
    }
    return context;
  }

  const absolutePath = path.join(
    process.cwd(),
    "src",
    "data",
    "exam-text",
    relativePath,
  );
  return JSON.parse(await readFile(absolutePath, "utf8"));
}
