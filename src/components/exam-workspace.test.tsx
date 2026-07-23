import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamWorkspace } from "./exam-workspace";
import type { Exam } from "@/lib/schemas";

vi.mock("@/components/pdf-viewer", () => ({
  PdfViewer: () => <div>PDF</div>,
}));

const { aiAccessMock } = vi.hoisted(() => ({
  aiAccessMock: vi.fn(),
}));
const { gradingSessionMock } = vi.hoisted(() => ({
  gradingSessionMock: vi.fn(),
}));

vi.mock("@/components/ai-feature-access", () => ({
  useAiFeatureAccess: aiAccessMock,
  AiFeatureAccessCard: ({ kind }: { kind: string }) => (
    <div>Acces necesar: {kind}</div>
  ),
  AiFeatureAccessSkeleton: () => <div>Se verifică accesul</div>,
}));

vi.mock("@/lib/attempts", () => ({
  saveGradingAttempt: vi.fn(),
}));

vi.mock("@/lib/grading-session", () => ({
  dismissGradingSession: vi.fn(),
  getGradingSession: gradingSessionMock,
  startGradingSession: vi.fn(),
  stopGradingSession: vi.fn(),
  subscribeGradingSession: () => () => {},
}));

const exam: Exam = {
  id: "test-exam",
  subject: "matematica",
  year: 2026,
  order: 0,
  profile: "M_mate-info",
  language: "LRO",
  sessionType: "model",
  sessionLabel: "Model",
  dateLabel: "2026",
  title: "Model 2026",
  examPdfPath: "/subject.pdf",
  baremPdfPath: "/barem.pdf",
  contextPath: "context.json",
  sourceKind: "ministry",
  sourceUrl: "https://example.com/subject.pdf",
  baremSourceUrl: "https://example.com/barem.pdf",
  sha256: { exam: "a".repeat(64), barem: "b".repeat(64) },
};

const platformExam: Exam = {
  ...exam,
  id: "olympiad:informatica:2026",
  category: "olympiad",
  sessionLabel: "Etapa națională",
  platform: {
    provider: "kilonova",
    url: "https://kilonova.ro/contests/123",
  },
};

class UnreadableImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

describe("ExamWorkspace image preflight", () => {
  beforeEach(() => {
    aiAccessMock.mockReturnValue({
      isLoading: false,
      isLocked: false,
      isSignedIn: true,
    });
    gradingSessionMock.mockReturnValue(undefined);
    vi.stubGlobal("Image", UnreadableImage);
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("blocks grading locally when an uploaded image is unreadable", async () => {
    render(<ExamWorkspace exam={exam} />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: {
        files: [new File(["broken"], "page.jpg", { type: "image/jpeg" })],
      },
    });

    expect(
      await screen.findByText("Imaginea nu poate fi citită. Înlocuiește fișierul."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corectează" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("explains when more than eight pages were selected", async () => {
    render(<ExamWorkspace exam={exam} />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const files = Array.from(
      { length: 10 },
      (_, index) =>
        new File(["page"], `page-${index + 1}.jpg`, { type: "image/jpeg" }),
    );

    fireEvent.change(input!, { target: { files } });

    expect(
      await screen.findByText("Ai selectat 10 poze. Am păstrat primele 8."),
    ).toBeInTheDocument();
    expect(screen.getByText("8/8 pagini")).toBeInTheDocument();
  });

  it("shows the access state instead of a misleading upload control", () => {
    aiAccessMock.mockReturnValue({
      isLoading: false,
      isLocked: true,
      isSignedIn: false,
    });

    render(<ExamWorkspace exam={exam} />);

    expect(screen.getByText("Acces necesar: corrector")).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Corectează" })).not.toBeInTheDocument();
  });

  it("opens platform tasks at the source and keeps screenshot grading available", () => {
    render(<ExamWorkspace exam={platformExam} />);

    expect(screen.queryByText("PDF")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rezolvă pe Kilonova" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Deschide în Kilonova/i })).toHaveAttribute(
      "href",
      platformExam.platform?.url,
    );
    expect(screen.getByText("Încarcă rezultatul de pe platformă")).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("restores the grading bar from the session start time", async () => {
    gradingSessionMock.mockReturnValue({
      status: "running",
      startedAt: Date.now() - 10_000,
      imageCount: 4,
    });
    render(<ExamWorkspace exam={exam} />);

    const progress = await screen.findByRole("progressbar");
    expect(Number(progress.getAttribute("aria-valuenow"))).toBeGreaterThan(40);
  });

  it("shows a completed grade without a save button", () => {
    gradingSessionMock.mockReturnValue({
      status: "done",
      startedAt: Date.now() - 10_000,
      imageCount: 1,
      updatedAt: "2026-07-19T10:00:00.000Z",
      result: {
        totalScore: 9.6,
        rawPoints: 96,
        confidence: 0.9,
        breakdown: [
          {
            section: "Subiectul I",
            item: "1",
            maxPoints: 5,
            awardedPoints: 5,
            feedback: "Corect.",
          },
        ],
        unclearWorkWarnings: [],
        manualReviewNotes: [],
      },
    });

    render(<ExamWorkspace exam={exam} />);

    expect(screen.getByText("9.60")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salvează rezultatul/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Modificările se salvează automat/i)).toBeInTheDocument();
  });
});

describe("ExamWorkspace camera capture", () => {
  beforeEach(() => {
    aiAccessMock.mockReturnValue({
      isLoading: false,
      isLocked: false,
      isSignedIn: true,
    });
    gradingSessionMock.mockReturnValue(undefined);
    vi.stubGlobal("Image", UnreadableImage);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      "navigator",
      Object.assign(navigator, {
        mediaDevices: {
          getUserMedia: () => Promise.reject(new DOMException("", "NotAllowedError")),
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("offers a camera button when the browser exposes getUserMedia", () => {
    render(<ExamWorkspace exam={exam} />);
    expect(
      screen.getByRole("button", { name: /Fă o poză acum/i }),
    ).toBeInTheDocument();
  });

  it("opens a camera dialog and surfaces a permission error", async () => {
    render(<ExamWorkspace exam={exam} />);
    fireEvent.click(screen.getByRole("button", { name: /Fă o poză acum/i }));

    const dialog = await screen.findByRole("dialog", {
      name: "Captează paginile cu camera",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      await screen.findByText(/Accesul la cameră a fost respins/i),
    ).toBeInTheDocument();
  });
});
