import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaremWorkspace } from "./barem-workspace";
import type { Exam } from "@/lib/schemas";
import { dismissBaremChatSession } from "@/lib/barem-chat-session";

vi.mock("@/components/pdf-viewer", () => ({
  PdfViewer: () => <div>PDF</div>,
}));

const { aiAccessMock } = vi.hoisted(() => ({
  aiAccessMock: vi.fn(),
}));

vi.mock("@/components/ai-feature-access", () => ({
  useAiFeatureAccess: aiAccessMock,
  AiFeatureAccessCard: ({ kind }: { kind: string }) => (
    <div>Acces necesar: {kind}</div>
  ),
  AiFeatureAccessSkeleton: () => <div>Se verifică accesul</div>,
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
  id: "olympiad:cybersecurity:2026",
  category: "olympiad",
  platform: {
    provider: "cyberedu",
    url: "https://cyberedu.ro/contest/123",
  },
};

const streamEvents = (...events: object[]) =>
  events.map((event) => `${JSON.stringify(event)}\n`).join("");

const answerEvents = (text: string) =>
  streamEvents(
    { type: "grounding", citations: [] },
    { type: "delta", text },
    { type: "done" },
  );

const requestId = "8a8d8e7f-3f03-4ca6-a4ac-38ad4c676e20";

describe("BaremWorkspace answer feedback", () => {
  beforeEach(() => {
    aiAccessMock.mockReturnValue({
      isLoading: false,
      isLocked: false,
      isSignedIn: true,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    window.sessionStorage.clear();
    window.localStorage?.clear();
    dismissBaremChatSession(exam.id);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps a completed answer locally without calling a feedback service", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(answerEvents("Explicație clară."), {
        headers: {
          "x-ai-request-id": requestId,
          "x-ai-context-target": "Subiectul%20I%2C%20itemul%201",
          "x-ai-context-subject-pages": "1",
          "x-ai-context-barem-pages": "1",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<BaremWorkspace exam={exam} />);

    fireEvent.change(screen.getByLabelText("Întrebare despre barem"), {
      target: { value: "Explică primul exercițiu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trimite" }));

    await waitFor(() => {
      expect(screen.getByText("Explicație clară.")).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Răspuns util" })).not.toBeInTheDocument();
  });

  it("lets the server adapt the response without exposing a mode control", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(answerEvents("Încearcă să factorizezi."));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<BaremWorkspace exam={exam} />);

    expect(screen.queryByLabelText("Tip răspuns")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Întrebare despre barem"), {
      target: { value: "Cum încep?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trimite" }));

    await waitFor(() => {
      expect(screen.getByText("Încearcă să factorizezi.")).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.getAllByText("IAbacu").length).toBeGreaterThan(0);
    const body = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body),
    );
    expect(body).not.toHaveProperty("mode");
  });

  it("keeps a completed answer inside the bounded conversation pane", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(answerEvents("Explicație completă."))),
    );
    render(<BaremWorkspace exam={exam} />);

    fireEvent.change(screen.getByLabelText("Întrebare despre barem"), {
      target: { value: "Explică exercițiul" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trimite" }));

    await waitFor(() =>
      expect(screen.getByText("Explicație completă.")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("log", { name: "Conversație cu asistentul" }),
    ).toHaveClass("min-h-0", "flex-1", "overflow-y-auto", "overscroll-contain");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("continues a streamed answer after leaving and returning to the page", async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(next) {
        controller = next;
        next.enqueue(new TextEncoder().encode(streamEvents(
          { type: "grounding", citations: [] },
          { type: "delta", text: "Prima parte. " },
        )));
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream)));
    const first = render(<BaremWorkspace exam={exam} />);

    fireEvent.change(screen.getByLabelText("Întrebare despre barem"), {
      target: { value: "Continuă răspunsul" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trimite" }));
    await waitFor(() => expect(screen.getByText("Prima parte.")).toBeInTheDocument());
    first.unmount();

    render(<BaremWorkspace exam={exam} />);

    await waitFor(() =>
      expect(screen.getByText("Prima parte.")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    controller?.enqueue(new TextEncoder().encode(streamEvents(
      { type: "delta", text: "A doua parte." },
      { type: "done" },
    )));
    controller?.close();

    await waitFor(() =>
      expect(screen.getByText("Prima parte. A doua parte.")).toBeInTheDocument(),
    );
  });

  it("keeps an incomplete answer and retries from its question", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(streamEvents(
          { type: "grounding", citations: [] },
          { type: "delta", text: "Răspuns parțial." },
          { type: "error", error: "Răspunsul s-a întrerupt." },
        )),
      )
      .mockResolvedValueOnce(new Response(answerEvents("Răspuns complet.")));
    vi.stubGlobal("fetch", fetchMock);
    render(<BaremWorkspace exam={exam} />);

    fireEvent.change(screen.getByLabelText("Întrebare despre barem"), {
      target: { value: "Explică exercițiul" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trimite" }));

    await waitFor(() => {
      expect(screen.getByText("Răspuns parțial.")).toBeInTheDocument();
      expect(screen.getByText("Răspuns incomplet")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Copiază răspunsul" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Încearcă din nou" }));
    await waitFor(() => expect(screen.getByText("Răspuns complet.")).toBeInTheDocument());
    expect(screen.queryByText("Răspuns parțial.")).not.toBeInTheDocument();
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)).messages).toEqual([
      { role: "user", content: "Explică exercițiul" },
    ]);
  });

  it("shows a serialized provider error as an error instead of an answer", async () => {
    const serializedError = JSON.stringify({
      type: "error",
      error: "Răspunsul s-a întrerupt. Încearcă din nou.",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(answerEvents(serializedError), {
          headers: { "x-ai-request-id": requestId },
        }),
      ),
    );
    render(<BaremWorkspace exam={exam} />);

    fireEvent.change(screen.getByLabelText("Întrebare despre barem"), {
      target: { value: "Explică exercițiul" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trimite" }));

    await waitFor(() =>
      expect(
        screen.getByText("Răspunsul s-a întrerupt. Încearcă din nou."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(serializedError)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Răspuns util" })).not.toBeInTheDocument();
  });

  it("shows one clear access state instead of an unusable composer", () => {
    aiAccessMock.mockReturnValue({
      isLoading: false,
      isLocked: true,
      isSignedIn: false,
    });

    render(<BaremWorkspace exam={exam} />);

    expect(screen.getByText("Acces necesar: questions")).toBeInTheDocument();
    expect(screen.queryByLabelText("Întrebare despre barem")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trimite" })).not.toBeInTheDocument();
  });

  it("replaces the barem PDF with the platform result panel", () => {
    render(<BaremWorkspace exam={platformExam} />);

    expect(screen.queryByText("PDF")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Verifică rezultatul pe CyberEDU" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Deschide în CyberEDU/i })).toHaveAttribute(
      "href",
      platformExam.platform?.url,
    );
  });
});
