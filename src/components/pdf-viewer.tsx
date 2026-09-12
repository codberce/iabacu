"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { PdfPage } from "@/components/pdf-page";
import type { BaremCitation } from "@/lib/barem-chat";

type PdfViewerProps = {
  src?: string;
  title: string;
  className?: string;
  focusPage?: number;
  focusRequestId?: number;
  focusCitations?: BaremCitation[];
  examId?: string;
  documentId?: string;
  documentSha256?: string;
};

const maxPageWidth = 980;

export function PdfViewer({
  src,
  title,
  className = "",
  focusPage,
  focusRequestId,
  focusCitations,
  examId,
  documentId,
  documentSha256,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [error, setError] = useState<string | null>(null);

  const handleRenderError = useCallback(() => {
    setError("PDF-ul nu a putut fi afișat.");
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Lazy-load once the container scrolls into view. The setShouldLoad(true)
  // fallback path (no IntersectionObserver, e.g. jsdom) is an intentional
  // external-store subscribe pattern: outside of that we only schedule
  // callback updates when the intersection state changes.
  useEffect(() => {
    if (!src) return;

    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    if (!shouldLoad || !src) return;

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();

        loadingTask = pdfjs.getDocument({ url: src });
        const loadedPdf = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        setPdf(loadedPdf);
        setPageCount(loadedPdf.numPages);
      } catch {
        if (!cancelled) {
          setError("PDF-ul nu a putut fi încărcat automat.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [shouldLoad, src]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdf || !focusPage || focusPage > pageCount) return;
    // When the focused page has citations, the cited passage scrolls itself
    // into view once highlighted; a page-level scroll would fight it.
    if (focusCitations?.some((citation) => citation.page === focusPage)) {
      return;
    }
    const page = container.querySelector<HTMLElement>(
      `[data-pdf-page="${focusPage}"]`,
    );
    page?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusPage, focusRequestId, focusCitations, pageCount, pdf]);

  if (!src) {
    return (
      <div
        ref={containerRef}
        className={`flex min-h-[420px] flex-col items-center justify-center gap-2 bg-zinc-100 px-4 text-center text-sm text-zinc-700 ${className}`}
        aria-label={title}
      >
        <p className="font-medium">Documentul nu este disponibil încă. Nu afișăm o substituție.</p>
      </div>
    );
  }

  const reportHref = examId && documentId
    ? `/raport-document-gresit?examId=${encodeURIComponent(examId)}&documentId=${encodeURIComponent(documentId)}${documentSha256 ? `&sha256=${encodeURIComponent(documentSha256)}` : ""}`
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`min-h-0 bg-zinc-100 lg:h-full lg:overflow-auto ${className}`}
      aria-label={title}
    >
      {!shouldLoad || isLoading ? (
        <div className="flex min-h-[420px] items-center justify-center text-zinc-600">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
      ) : null}

      {error ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-zinc-700">
          <p>{error}</p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center border border-zinc-950 bg-white px-4 font-semibold text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
          >
            Deschide PDF
          </a>
        </div>
      ) : null}

      {!isLoading && !error ? (
        <div className="flex flex-col items-center gap-3 p-2 lg:min-h-full">
          {pdf && pageCount > 0 ? (
            <>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                (pageNumber) => {
                  const marks = focusCitations?.find(
                    (citation) => citation.page === pageNumber,
                  )?.texts;
                  return (
                    <PdfPage
                      key={pageNumber}
                      pdf={pdf}
                      pageNumber={pageNumber}
                      width={Math.max(240, Math.min(containerWidth - 16, maxPageWidth))}
                      title={title}
                      eager={pageNumber === 1 || Boolean(marks?.length)}
                      onError={handleRenderError}
                      marks={marks}
                      marksRequestId={focusRequestId}
                      scrollToMark={pageNumber === focusPage}
                    />
                  );
                },
              )}
              {reportHref ? (
                <a
                  href={reportHref}
                  className="text-xs font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                >
                  Raportează document greșit
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
