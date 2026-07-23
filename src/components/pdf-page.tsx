"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask, TextLayer as PDFTextLayer } from "pdfjs-dist";
import { clearCitedHighlights, highlightCitedText } from "@/lib/pdf-highlight";

type PdfPageProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  title: string;
  eager?: boolean;
  onError: () => void;
  marks?: string[];
  marksRequestId?: number;
  scrollToMark?: boolean;
};

export function PdfPage({
  pdf,
  pageNumber,
  width,
  title,
  eager = false,
  onError,
  marks,
  marksRequestId,
  scrollToMark = false,
}: PdfPageProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledRequestRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(eager);
  const [textLayerVersion, setTextLayerVersion] = useState(0);

  useEffect(() => {
    if (eager || isVisible) return;
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [eager, isVisible]);

  useEffect(() => {
    if (!isVisible || width <= 0) return;
    const canvas = canvasRef.current;
    const textLayerContainer = textLayerRef.current;
    if (!canvas || !textLayerContainer) return;
    const currentCanvas = canvas;
    const currentTextLayerContainer = textLayerContainer;

    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let textLayer: PDFTextLayer | undefined;

    async function renderPage() {
      try {
        const { TextLayer } = await import("pdfjs-dist");
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = width / baseViewport.width;
        const cssViewport = page.getViewport({ scale: cssScale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const renderViewport = page.getViewport({ scale: cssScale * outputScale });
        const context = currentCanvas.getContext("2d");
        if (!context) return;

        currentCanvas.width = Math.floor(renderViewport.width);
        currentCanvas.height = Math.floor(renderViewport.height);
        currentCanvas.style.width = `${Math.floor(cssViewport.width)}px`;
        currentCanvas.style.height = `${Math.floor(cssViewport.height)}px`;
        currentTextLayerContainer.style.setProperty("--total-scale-factor", `${cssScale}`);
        currentTextLayerContainer.style.setProperty("--scale-round-x", "1px");
        currentTextLayerContainer.style.setProperty("--scale-round-y", "1px");

        renderTask = page.render({ canvas: currentCanvas, canvasContext: context, viewport: renderViewport });
        await renderTask.promise;
        if (cancelled) return;

        currentTextLayerContainer.replaceChildren();
        textLayer = new TextLayer({
          textContentSource: await page.getTextContent(),
          container: currentTextLayerContainer,
          viewport: cssViewport,
        });
        await textLayer.render();
        page.cleanup();
        if (cancelled) return;
        setTextLayerVersion((version) => version + 1);
      } catch (error) {
        if (
          !cancelled &&
          !(error instanceof Error && error.name === "RenderingCancelledException")
        ) {
          onError();
        }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [isVisible, onError, pageNumber, pdf, width]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || textLayerVersion === 0) return;
    if (!marks?.length) {
      clearCitedHighlights(root);
      return;
    }
    const firstMark = highlightCitedText(root, marks);
    if (
      scrollToMark &&
      marksRequestId != null &&
      lastScrolledRequestRef.current !== marksRequestId
    ) {
      lastScrolledRequestRef.current = marksRequestId;
      (firstMark ?? root).scrollIntoView({
        behavior: "smooth",
        block: firstMark ? "center" : "start",
      });
    }
  }, [marks, marksRequestId, scrollToMark, textLayerVersion]);

  return (
    <div
      ref={rootRef}
      data-pdf-page={pageNumber}
      className="relative min-h-[720px] bg-white shadow-sm"
      aria-busy={!isVisible}
    >
      <canvas
        ref={canvasRef}
        className="block bg-white"
        role="img"
        aria-label={`${title}, pagina ${pageNumber}`}
      />
      <div ref={textLayerRef} className="pdf-text-layer" />
    </div>
  );
}
