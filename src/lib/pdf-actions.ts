import type { PDFDocumentProxy } from "pdfjs-dist";

export async function downloadPdf(src: string, title: string) {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Documentul nu poate fi descărcat.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = `${title.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 120) || "document"}.pdf`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Render a standalone printable document, including pages not yet visible. */
export async function printPdf(pdf: PDFDocumentProxy, title: string, popup: Window) {
  popup.document.title = title;
  const style = popup.document.createElement("style");
  style.textContent = "@page{size:A4;margin:0}body{margin:0;background:white}img{display:block;width:100%;break-after:page}img:last-child{break-after:auto}";
  popup.document.head.append(style);
  popup.document.body.textContent = "Se pregătește documentul…";
  const pages: HTMLImageElement[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    if (popup.closed) return;
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const image = popup.document.createElement("img");
    image.alt = `${title}, pagina ${number}`;
    image.src = canvas.toDataURL("image/png");
    await image.decode();
    pages.push(image); canvas.width = canvas.height = 0;
  }
  if (popup.closed) return;
  popup.document.body.replaceChildren(...pages);
  popup.focus(); popup.print();
}
