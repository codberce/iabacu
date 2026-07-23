import {
  parseAiChatErrorMessage,
} from "@/lib/barem-chat";
import {
  parseBaremChatStreamEvent,
} from "@/lib/barem-chat-stream";
import {
  saveWorkspace,
  type WorkspaceMessage,
  writeWorkspace,
} from "@/lib/workspace-store";

export type ChatGrounding = NonNullable<WorkspaceMessage["grounding"]>;
export type BaremChatSession = {
  status: "streaming" | "done" | "error" | "aborted";
  startedAt: number;
  firstToken: boolean;
  baseMessages: WorkspaceMessage[];
  content: string;
  grounding?: ChatGrounding;
  requestId?: string;
  remaining?: string | null;
  error?: string;
};

type Session = BaremChatSession & {
  controller: AbortController;
  examId: string;
  userId: string | null;
};

const sessions = new Map<string, Session>();
const listeners = new Map<string, Set<() => void>>();

function notify(examId: string) {
  listeners.get(examId)?.forEach((listener) => listener());
}

function current(session: Session) {
  return sessions.get(session.examId)?.controller === session.controller;
}

function patch(session: Session, update: Partial<Session>) {
  if (!current(session)) return;
  const active = sessions.get(session.examId)!;
  sessions.set(session.examId, { ...active, ...update });
  notify(session.examId);
}

function pages(value: string | null) {
  return (value ?? "").split(",").map(Number).filter((page) => Number.isInteger(page) && page > 0);
}

function grounding(response: Response): ChatGrounding | undefined {
  const encodedTarget = response.headers.get("x-ai-context-target");
  const subjectPages = pages(response.headers.get("x-ai-context-subject-pages"));
  const baremPages = pages(response.headers.get("x-ai-context-barem-pages"));
  const target = encodedTarget ? decodeURIComponent(encodedTarget) : undefined;
  return target || subjectPages.length || baremPages.length ? { target, subjectPages, baremPages } : undefined;
}

function mergeGrounding(
  session: Session,
  citations: ChatGrounding["citations"],
) {
  patch(session, {
    grounding: {
      ...(sessions.get(session.examId)?.grounding ?? {
        subjectPages: [],
        baremPages: [],
      }),
      ...(citations?.length ? { citations } : {}),
    },
  });
}

function persist(session: Session, assistant?: WorkspaceMessage) {
  const chat = { messages: assistant ? [...session.baseMessages, assistant] : session.baseMessages, updatedAt: new Date().toISOString() };
  writeWorkspace(session.examId, session.userId, { chat });
  if (session.userId) void saveWorkspace(session.examId, { chat });
}

function finish(session: Session, answer: string) {
  if (!current(session)) return;
  const responseError = parseAiChatErrorMessage(answer);
  if (responseError) {
    persist(session);
    patch(session, { status: "error", content: "", error: responseError });
    return;
  }
  if (!answer.trim()) {
    persist(session);
    patch(session, { status: "error", error: "Modelul a returnat un mesaj gol." });
    return;
  }
  const state = sessions.get(session.examId)!;
  const assistant: WorkspaceMessage = {
    role: "assistant", content: answer, isComplete: true,
    grounding: state.grounding, requestId: state.requestId,
  };
  persist(session, assistant);
  patch(session, { status: "done", content: answer });
}

async function run(session: Session) {
  try {
    const response = await fetch("/api/barem-chat/stream", {
      method: "POST", headers: { "content-type": "application/json" }, signal: session.controller.signal,
      body: JSON.stringify({ examId: session.examId, messages: session.baseMessages.slice(-12).map(({ role, content }) => ({ role, content })) }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Explicația nu a putut fi generată.");
    }
    patch(session, {
      remaining: response.headers.get("x-ai-remaining"), grounding: grounding(response),
      requestId: response.headers.get("x-ai-request-id") ?? undefined,
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Răspunsul nu poate fi citit.");

    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let completed = false;
    const applyRecord = (line: string) => {
      const event = parseBaremChatStreamEvent(line);
      if (event.type === "grounding") {
        mergeGrounding(session, event.citations);
      } else if (event.type === "delta") {
        answer += event.text;
        patch(session, { content: answer, firstToken: Boolean(answer.trim()) });
      } else if (event.type === "done") {
        completed = true;
      } else {
        throw new Error(event.error || "Explicația nu a putut fi generată.");
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) applyRecord(line);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) applyRecord(buffer);
    if (!completed) {
      throw new Error("Răspunsul s-a întrerupt. Încearcă din nou.");
    }
    finish(session, answer);
  } catch (error) {
    if (!current(session)) return;
    const active = sessions.get(session.examId)!;
    const partial = active.content.trim() && !parseAiChatErrorMessage(active.content)
      ? { role: "assistant" as const, content: active.content, isComplete: false, grounding: active.grounding, requestId: active.requestId }
      : undefined;
    persist(session, partial);
    if (error instanceof DOMException && error.name === "AbortError") {
      patch(session, { status: "aborted" });
    } else {
      patch(session, { status: "error", error: error instanceof Error ? error.message : "Explicația nu a putut fi generată." });
    }
  }
}

export function getBaremChatSession(examId: string) { return sessions.get(examId); }
export function subscribeBaremChatSession(examId: string, listener: () => void) {
  const set = listeners.get(examId) ?? new Set<() => void>();
  listeners.set(examId, set); set.add(listener);
  return () => set.delete(listener);
}
export function startBaremChatSession(input: { examId: string; messages: WorkspaceMessage[]; userId: string | null }) {
  const previous = sessions.get(input.examId);
  if (previous?.status === "streaming") previous.controller.abort();
  const session: Session = { ...input, controller: new AbortController(), status: "streaming", startedAt: Date.now(), firstToken: false, baseMessages: input.messages, content: "" };
  sessions.set(input.examId, session);
  persist(session);
  notify(input.examId);
  void run(session);
}
export function stopBaremChatSession(examId: string) { sessions.get(examId)?.controller.abort(); }
export function dismissBaremChatSession(examId: string) {
  const session = sessions.get(examId);
  if (session && session.status !== "streaming") { sessions.delete(examId); notify(examId); }
}
