import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfViewer } from "./pdf-viewer";

const { pdfMock } = vi.hoisted(() => ({
  pdfMock: {
    promise: Promise.resolve({ numPages: 2 }),
    destroy: vi.fn(),
  },
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(() => pdfMock),
}));

vi.mock("./pdf-page", () => ({
  PdfPage: ({ pageNumber }: { pageNumber: number }) => (
    <div data-pdf-page={pageNumber}>Pagina {pageNumber}</div>
  ),
}));

describe("PdfViewer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows an honest unavailable state without a document URL", () => {
    render(<PdfViewer title="Subiect" />);
    expect(screen.getByText("Documentul nu este disponibil încă. Nu afișăm o substituție.")).toBeInTheDocument();
  });

  it("prefills a report link with stable document details", async () => {
    render(<PdfViewer src="/subject.pdf" title="Subiect" examId="exam-1" documentId="subject" documentSha256={"a".repeat(64)} />);
    const link = await screen.findByRole("link", { name: "Raportează document greșit" });
    expect(link).toHaveAttribute("href", expect.stringContaining("exam-1"));
    expect(link).toHaveAttribute("href", expect.stringContaining("subject"));
  });

  it("renders every PDF page without a page-count toolbar", async () => {
    render(<PdfViewer src="/subject.pdf" title="Subiect" />);
    expect(await screen.findByText("Pagina 1")).toBeInTheDocument();
    expect(screen.getByText("Pagina 2")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Salt la pagină" })).not.toBeInTheDocument();
  });
});
