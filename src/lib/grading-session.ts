import { saveWorkspace, workspaceGradeSchema, writeWorkspace } from "@/lib/workspace-store";
import { saveGradingAttempt } from "@/lib/attempts";
import type { GradeResult } from "@/lib/schemas";
import { workImageCompressionTarget } from "@/lib/work-image-quality";

export type GradingSession = {
  status: "running" | "done" | "error";
  startedAt: number;
  imageCount: number;
  result?: GradeResult;
  updatedAt?: string;
  remaining?: string | null;
  error?: string;
};

type Session = GradingSession & {
  controller: AbortController;
  files: File[];
  examId: string;
  userId: string | null;
};

const sessions = new Map<string, Session>();
const listeners = new Map<string, Set<() => void>>();

function notify(examId: string) {
  listeners.get(examId)?.forEach((listener) => listener());
}

function patch(session: Session, update: Partial<Session>) {
  if (sessions.get(session.examId)?.controller !== session.controller) return;
  const active = sessions.get(session.examId)!;
  sessions.set(session.examId, { ...active, ...update });
  notify(session.examId);
}

async function compress(file: File, targetBytes: number): Promise<File> {
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Imaginea nu poate fi citită."));
      image.src = url;
    });
    const scale = Math.min(1, 2200 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browserul nu poate comprima imaginea.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob: Blob | undefined;
    for (const quality of [0.88, 0.78, 0.68]) {
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Compresia a eșuat.")), "image/jpeg", quality),
      );
      if (blob.size <= targetBytes) break;
    }
    if (!blob) throw new Error("Compresia a eșuat.");
    if (blob.size > file.size && file.size <= targetBytes) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "lucrare"}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function run(session: Session) {
  try {
    const compressed = await Promise.all(
      session.files.map((file) => compress(file, workImageCompressionTarget(session.files.length))),
    );
    const formData = new FormData();
    formData.append("examId", session.examId);
    compressed.forEach((file) => formData.append("work", file, file.name));
    const response = await fetch("/api/grade", {
      method: "POST", body: formData, signal: session.controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Corectarea a eșuat.");
    const grade = workspaceGradeSchema.parse({
      result: body.result, imageCount: session.files.length, updatedAt: new Date().toISOString(),
    });
    patch(session, {
      status: "done", result: grade.result, updatedAt: grade.updatedAt,
      remaining: response.headers.get("x-ai-remaining"),
    });
    writeWorkspace(session.examId, session.userId, { grade });
    if (session.userId) void saveWorkspace(session.examId, { grade });
    if (!grade.result.reviewRequired) {
      saveGradingAttempt(session.examId, grade.result, grade.updatedAt);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    patch(session, { status: "error", error: error instanceof Error ? error.message : "Corectarea a eșuat." });
  }
}

export function getGradingSession(examId: string) {
  return sessions.get(examId);
}

export function subscribeGradingSession(examId: string, listener: () => void) {
  const set = listeners.get(examId) ?? new Set<() => void>();
  listeners.set(examId, set);
  set.add(listener);
  return () => set.delete(listener);
}

export function startGradingSession(input: { examId: string; files: File[]; userId: string | null }) {
  const previous = sessions.get(input.examId);
  if (previous?.status === "running") previous.controller.abort();
  const session: Session = {
    examId: input.examId, files: input.files, userId: input.userId,
    controller: new AbortController(), status: "running", startedAt: Date.now(), imageCount: input.files.length,
  };
  sessions.set(input.examId, session);
  notify(input.examId);
  void run(session);
}

export function stopGradingSession(examId: string) {
  sessions.get(examId)?.controller.abort();
}

export function dismissGradingSession(examId: string) {
  const session = sessions.get(examId);
  if (session && session.status !== "running") {
    sessions.delete(examId);
    notify(examId);
  }
}
