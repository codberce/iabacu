import { afterEach, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { downloadPdf, printPdf } from "./pdf-actions";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("prepares every page for printing, including pages never scrolled into view", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AA==");
  Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
  const page = { getViewport: () => ({ width: 595, height: 842 }), render: vi.fn(() => ({ promise: Promise.resolve() })) };
  const pdf = { numPages: 3, getPage: vi.fn().mockResolvedValue(page) };
  const popup = { document: document.implementation.createHTMLDocument(), closed: false, focus: vi.fn(), print: vi.fn() };
  await printPdf(pdf as unknown as PDFDocumentProxy, "Subiect", popup as unknown as Window);
  expect(pdf.getPage.mock.calls.map(([number]) => number)).toEqual([1, 2, 3]);
  expect(popup.document.querySelectorAll("img")).toHaveLength(3);
  expect(popup.print).toHaveBeenCalledOnce();
});
it("downloads the PDF as a file even for a cross-origin source", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("%PDF-test", { headers: { "content-type": "application/pdf" } })));
  const create = vi.fn(() => "blob:download"); const revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) { expect(this.download).toBe("Subiect.pdf"); expect(this.href).toBe("blob:download"); });
  await downloadPdf("https://assets.example/subject.pdf", "Subiect");
  expect(click).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(60000); expect(revoke).toHaveBeenCalledWith("blob:download");
});
it("reports a failed download instead of saving an error page as PDF", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
  await expect(downloadPdf("https://assets.example/subject.pdf", "Subiect")).rejects.toThrow("descărcat");
});
