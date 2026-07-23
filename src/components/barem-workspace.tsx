"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  ChevronRight,
  Copy,
  FileText,
  RotateCcw,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import {
  AiFeatureAccessCard,
  AiFeatureAccessSkeleton,
  useAiFeatureAccess,
} from "@/components/ai-feature-access";
import { PlatformTaskPanel } from "@/components/platform-task-panel";
import type { BaremChatMessage, BaremCitation } from "@/lib/barem-chat";
import type { Exam } from "@/lib/schemas";
import {
  dismissBaremChatSession,
  getBaremChatSession,
  startBaremChatSession,
  stopBaremChatSession,
  subscribeBaremChatSession,
} from "@/lib/barem-chat-session";
import {
  readWorkspace,
  reconcileWorkspace,
  saveWorkspace,
  type WorkspaceMessage,
  writeWorkspace,
} from "@/lib/workspace-store";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  { ssr: false },
);

const AiMessage = dynamic(
  () => import("@/components/ai-message").then((mod) => mod.AiMessage),
  { ssr: false },
);

type BaremWorkspaceProps = {
  exam: Exam;
  backHref?: string;
  subjectHref?: string;
};

type ActivePanel = "barem" | "chat";

type ChatGrounding = {
  target?: string;
  subjectPages: number[];
  baremPages: number[];
  citations?: BaremCitation[];
};

type UiChatMessage = BaremChatMessage & {
  grounding?: ChatGrounding;
  requestId?: string;
  isComplete?: boolean;
};

function starterPrompts(exam: Exam) {
  if (exam.id.startsWith("olimpiada-") || exam.id.startsWith("olympiad:")) {
    return [
      "Explică problema 1 pas cu pas",
      "Ce idee-cheie se folosește la problema 2?",
      "Cum se acordă punctajul la problema 3?",
    ];
  }
  return [
    "Explică Subiectul I, exercițiul 1",
    "Dă-mi un indiciu pentru Subiectul II, exercițiul 1.a",
    "Cum se acordă punctajul la Subiectul III, exercițiul 2?",
  ];
}

export function BaremWorkspace({
  exam,
  backHref,
  subjectHref,
}: BaremWorkspaceProps) {
  const { isLoading: isAiAccessLoading, isLocked: isAiLocked, userId } =
    useAiFeatureAccess();
  const [activePanel, setActivePanel] = useState<ActivePanel>("barem");
  const [messages, setMessages] = useState<UiChatMessage[]>(
    () => readWorkspace(exam.id, null).chat?.messages ?? [],
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remainingQuestions, setRemainingQuestions] = useState<string | null>(
    null,
  );
  const [baremFocus, setBaremFocus] = useState<{
    page: number;
    requestId: number;
    citations?: BaremCitation[];
  }>();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesFingerprintRef = useRef<string | null>(null);
  const chatSession = useSyncExternalStore(
    (callback) => subscribeBaremChatSession(exam.id, callback),
    () => getBaremChatSession(exam.id),
    () => undefined,
  );
  const isSending = chatSession?.status === "streaming";
  const displayedMessages = useMemo<UiChatMessage[]>(
    () => chatSession?.content
      ? [...messages, {
          role: "assistant",
          content: chatSession.content,
          isComplete: chatSession.status === "done",
          grounding: chatSession.grounding,
          requestId: chatSession.requestId,
        }]
      : messages,
    [chatSession, messages],
  );

  useEffect(() => {
    const fingerprint = JSON.stringify(messages);
    if (messagesFingerprintRef.current === null) {
      messagesFingerprintRef.current = fingerprint;
      return;
    }
    if (messagesFingerprintRef.current === fingerprint) return;
    messagesFingerprintRef.current = fingerprint;
    const chat = { messages: messages as WorkspaceMessage[], updatedAt: new Date().toISOString() };
    writeWorkspace(exam.id, userId, { chat });
    if (userId) void saveWorkspace(exam.id, { chat });
  }, [exam.id, messages, userId]);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate the UI from the external session store */
  useEffect(() => {
    if (!chatSession || chatSession.status === "streaming") return;
    if (chatSession.content) {
      setMessages([
        ...(chatSession.baseMessages as UiChatMessage[]),
        {
          role: "assistant",
          content: chatSession.content,
          isComplete: chatSession.status === "done",
          grounding: chatSession.grounding,
          requestId: chatSession.requestId,
        },
      ]);
    } else {
      setMessages(chatSession.baseMessages as UiChatMessage[]);
    }
    if (chatSession.status === "error") setError(chatSession.error ?? "Explicația nu a putut fi generată.");
    if (chatSession.remaining) setRemainingQuestions(chatSession.remaining);
    dismissBaremChatSession(exam.id);
  }, [chatSession, exam.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void reconcileWorkspace(exam.id, userId).then((workspace) => {
      if (!cancelled && !getBaremChatSession(exam.id) && workspace.chat) {
        setMessages(workspace.chat.messages as UiChatMessage[]);
      }
    });
    return () => { cancelled = true; };
  }, [exam.id, userId]);

  useEffect(() => {
    function handleSlash(event: KeyboardEvent) {
      if (event.key !== "/" || isAiLocked) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      textareaRef.current?.focus();
    }
    window.addEventListener("keydown", handleSlash);
    return () => window.removeEventListener("keydown", handleSlash);
  }, [isAiLocked]);

  function stopMessage() {
    stopBaremChatSession(exam.id);
  }

  function startNewConversation() {
    setMessages([]);
    setDraft("");
    setError(null);
    const chat = { messages: [], updatedAt: new Date().toISOString() };
    writeWorkspace(exam.id, userId, { chat });
    if (userId) void saveWorkspace(exam.id, { chat });
  }

  function sendStarterPrompt(prompt: string) {
    setDraft(prompt);
    setActivePanel("chat");
    requestAnimationFrame(() => {
      textareaRef.current?.form?.requestSubmit();
    });
  }

  async function copyToClipboard(index: number, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      window.setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current));
      }, 2000);
    } catch {
      // clipboard not available
    }
  }

  function retryIncompleteMessage(index: number) {
    if (isSending) return;
    const partial = messages[index];
    const question = messages[index - 1];
    if (
      partial?.role !== "assistant" ||
      partial.isComplete ||
      question?.role !== "user"
    ) return;

    setError(null);
    const nextMessages = messages.slice(0, index) as UiChatMessage[];
    setMessages(nextMessages);
    startBaremChatSession({
      examId: exam.id,
      messages: nextMessages as WorkspaceMessage[],
      userId,
    });
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAiLocked) return;
    const content = draft.trim();
    if (!content || isSending) return;

    setError(null);
    setDraft("");
    const nextMessages: UiChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    startBaremChatSession({
      examId: exam.id,
      messages: nextMessages as WorkspaceMessage[],
      userId,
    });
  }

  return (
    <section aria-labelledby="barem-workspace-title" className="h-[calc(100dvh-3.5rem)] min-h-[540px] overflow-hidden bg-[#f3f5f1] text-zinc-950">
      <div className="mx-auto flex h-full w-full min-w-0 max-w-[1800px] flex-col gap-3 overflow-hidden p-3 lg:grid lg:grid-rows-[auto_minmax(0,1fr)] lg:p-4">
        <header className="grid min-h-0 gap-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.035)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref ?? `/${exam.subject}`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950"
              aria-label="Înapoi la lista de examene"
              title="Înapoi"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 id="barem-workspace-title" className="truncate text-xl font-semibold leading-6">
                {exam.sessionLabel}
              </h1>
              <p className="truncate text-sm text-zinc-600">
                {exam.dateLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href={subjectHref ?? `/exam/${exam.id}`}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <FileText className="h-4 w-4" />
              <span>{exam.platform ? "Probă" : "Subiect"}</span>
            </Link>
          </div>
        </header>

        <nav aria-label="Panou mobil" className={`${exam.platform ? "grid-cols-1" : "grid-cols-2"} grid gap-1 rounded-xl bg-zinc-200/70 p-1 lg:hidden`}>
          <button
            type="button"
            onClick={() => setActivePanel("barem")}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
              activePanel === "barem"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            {exam.platform ? "Platformă" : "Barem"}
          </button>
          {!exam.platform ? <button
            type="button"
            onClick={() => {
              setActivePanel("chat");
            }}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
              activePanel === "chat"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            Întreabă
          </button> : null}
        </nav>

        <div className={`grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-rows-1 ${exam.platform ? "" : "lg:grid-cols-[minmax(0,1fr)_410px]"}`}>
          <section
            className={`min-h-[420px] min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.04)] lg:block lg:min-h-0 ${
              activePanel === "barem" ? "block" : "hidden"
            }`}
          >
            {exam.platform ? (
              <PlatformTaskPanel platform={exam.platform} view="barem" />
            ) : (
              <PdfViewer
                src={exam.baremPdfPath}
                title={`Barem ${exam.title}`}
                focusPage={baremFocus?.page}
                focusRequestId={baremFocus?.requestId}
                focusCitations={baremFocus?.citations}
              />
            )}
          </section>

          {!exam.platform ? <aside
            className={`min-h-[520px] min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.04)] lg:block lg:min-h-0 ${
              activePanel === "chat" ? "block" : "hidden"
            }`}
          >
            <section className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-zinc-100 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold leading-6">
                    <Sparkles className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    Asistent AI
                  </h2>
                  <div className="flex items-center gap-2">
                    {remainingQuestions ? (
                      <span className="hidden text-xs font-semibold text-zinc-500 sm:inline">
                        {remainingQuestions === "unlimited"
                          ? "Nelimitat"
                          : `${remainingQuestions} rămase`}
                      </span>
                    ) : null}
                    {displayedMessages.length > 0 ? (
                      <button
                        type="button"
                        onClick={startNewConversation}
                        disabled={isSending}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50"
                        aria-label="Conversație nouă"
                        title="Conversație nouă"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {isAiAccessLoading ? (
                <div className="min-h-0 flex-1">
                  <AiFeatureAccessSkeleton />
                </div>
              ) : isAiLocked ? (
                <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
                  <AiFeatureAccessCard kind="questions" />
                </div>
              ) : (
                <>
              <div
                role="log"
                aria-label="Conversație cu asistentul"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
              >
                {displayedMessages.length === 0 ? (
                  <div className="py-1 text-sm text-zinc-700">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
                      <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="mt-2 text-base font-semibold text-zinc-950">
                      Cu ce item vrei să lucrăm?
                    </p>
                    <div className="mt-3 flex flex-col gap-1.5">
                      {starterPrompts(exam).map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => sendStarterPrompt(prompt)}
                          className="group flex min-h-10 items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 text-left text-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                        >
                          <span className="font-semibold">
                            {prompt}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-950" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3" aria-live="polite" aria-busy={isSending ? "true" : "false"}>
                    {displayedMessages.map((message, index) => (
                      <article
                        key={`${message.role}-${index}`}
                        className={
                          message.role === "user"
                            ? "ml-10 rounded-2xl rounded-br-md bg-zinc-950 p-3 text-sm text-white shadow-sm"
                            : "border-b border-zinc-200 pb-4 text-sm text-zinc-900 last:border-b-0"
                        }
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase opacity-70">
                            {message.role === "user" ? "Tu" : "IAbacu"}
                          </p>
                          {message.role === "assistant" && message.isComplete && message.content ? (
                            <button
                              type="button"
                              onClick={() => void copyToClipboard(index, message.content)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-950"
                              aria-label="Copiază răspunsul"
                              title="Copiază"
                            >
                              {copiedIndex === index ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : null}
                        </div>
                        {message.role === "assistant" ? (
                          message.content ? (
                            <div>
                              <AiMessage content={message.content} />
                              {message.grounding ? (
                                <div className="mt-3 border-t border-zinc-200 pt-2 text-xs text-zinc-600">
                                  <p className="truncate font-semibold text-zinc-700" title={message.grounding.target}>
                                    Barem oficial
                                    {message.grounding.target
                                      ? ` · ${message.grounding.target}`
                                      : ""}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {message.grounding.citations &&
                                    message.grounding.citations.length > 0
                                      ? message.grounding.citations.map(
                                          (citation) => (
                                            <button
                                              key={citation.page}
                                              type="button"
                                              onClick={() => {
                                                const citations =
                                                  message.grounding?.citations;
                                                setActivePanel("barem");
                                                setBaremFocus((current) => ({
                                                  page: citation.page,
                                                  citations,
                                                  requestId:
                                                    (current?.requestId ?? 0) +
                                                    1,
                                                }));
                                              }}
                                              className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 font-semibold text-emerald-900 transition hover:border-emerald-700 hover:bg-emerald-100"
                                              title="Arată pasajul citat în barem"
                                            >
                                              Barem p. {citation.page}
                                            </button>
                                          ),
                                        )
                                      : null}
                                    {!message.grounding.citations?.length &&
                                    message.grounding.baremPages.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActivePanel("barem");
                                          setBaremFocus((current) => ({
                                            page:
                                              message.grounding?.baremPages[0] ??
                                              1,
                                            requestId:
                                              (current?.requestId ?? 0) + 1,
                                          }));
                                        }}
                                        className="border border-zinc-300 bg-white px-2 py-1 font-semibold text-zinc-700 hover:border-zinc-900 hover:text-zinc-950"
                                      >
                                        Barem p. {message.grounding.baremPages.join(", ")}
                                      </button>
                                    ) : null}
                                    {message.grounding.subjectPages.length > 0 ? (
                                      <Link
                                        href={`/exam/${exam.id}`}
                                        className="border border-zinc-300 bg-white px-2 py-1 font-semibold text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-950"
                                        title="Deschide subiectul"
                                      >
                                        Subiect p. {message.grounding.subjectPages.join(", ")}
                                      </Link>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                              {!message.isComplete && !isSending ? (
                                <div className="mt-3 flex items-center justify-between gap-3 border-t border-amber-200 pt-2 text-xs text-amber-900">
                                  <span className="font-semibold">Răspuns incomplet</span>
                                  <button
                                    type="button"
                                    onClick={() => retryIncompleteMessage(index)}
                                    className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 font-semibold transition hover:border-amber-700 hover:bg-amber-100"
                                  >
                                    Încearcă din nou
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null
                        ) : (
                          <p className="whitespace-pre-wrap leading-6">
                            {message.content}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                {error ? (
                  <p className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-950">
                    {error}
                  </p>
                ) : null}
              </div>

              <form onSubmit={sendMessage} className="shrink-0 border-t border-zinc-100 bg-white p-3">
                <label htmlFor="barem-question" className="sr-only">
                  Întrebare despre barem
                </label>
                <div className="flex items-end gap-2">
                  <textarea
                    id="barem-question"
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    className="h-16 min-w-0 flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="Cere un indiciu, o explicație sau punctajul..."
                  />
                  {isSending ? (
                    <button
                      type="button"
                      onClick={stopMessage}
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-950 transition hover:bg-zinc-100"
                      aria-label="Oprește răspunsul"
                      title="Oprește"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none"
                      aria-label="Trimite"
                      title="Trimite"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </form>
                </>
              )}
            </section>
          </aside> : null}
        </div>
      </div>
    </section>
  );
}
