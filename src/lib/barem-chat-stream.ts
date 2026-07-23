import type { BaremCitation } from "@/lib/barem-chat";

export type BaremChatStreamEvent =
  | { type: "grounding"; citations: BaremCitation[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };

const encoder = new TextEncoder();

export function encodeBaremChatStreamEvent(event: BaremChatStreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export function parseBaremChatStreamEvent(value: string): BaremChatStreamEvent {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    throw new Error("Protocol de răspuns invalid.");
  }

  if (parsed.type === "grounding") {
    const citations = "citations" in parsed && Array.isArray(parsed.citations)
      ? parsed.citations.filter((citation): citation is BaremCitation =>
          Boolean(citation) &&
          typeof citation === "object" &&
          typeof (citation as BaremCitation).page === "number" &&
          Array.isArray((citation as BaremCitation).texts),
        )
      : [];
    return { type: "grounding", citations };
  }
  if (parsed.type === "delta" && "text" in parsed && typeof parsed.text === "string") {
    return { type: "delta", text: parsed.text };
  }
  if (parsed.type === "done") return { type: "done" };
  if (parsed.type === "error" && "error" in parsed && typeof parsed.error === "string") {
    return { type: "error", error: parsed.error };
  }

  throw new Error("Protocol de răspuns invalid.");
}
