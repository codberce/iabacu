import { z } from "zod";
import { parseAiChatErrorMessage } from "@/lib/barem-chat";
import { gradeResultSchema } from "@/lib/schemas";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "@/lib/safe-browser-storage";

export const workspaceGradeSchema = z.object({
  result: gradeResultSchema,
  imageCount: z.number().int().min(1).max(8),
  updatedAt: z.string().datetime(),
});

export const workspaceCitationSchema = z.object({
  page: z.number().int().positive(),
  texts: z.array(z.string().min(1)).min(1),
});

export const workspaceMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(20_000),
  isComplete: z.boolean().optional(),
  requestId: z.string().max(100).optional(),
  grounding: z
    .object({
      target: z.string().max(500).optional(),
      subjectPages: z.array(z.number().int().positive()).max(50),
      baremPages: z.array(z.number().int().positive()).max(50),
      citations: z.array(workspaceCitationSchema).max(20).optional(),
    })
    .optional(),
  feedbackChoice: z.enum(["helpful", "not_helpful"]).optional(),
  feedbackStatus: z.enum(["submitting", "submitted", "error"]).optional(),
  feedbackError: z.string().max(500).optional(),
});

export const workspaceChatSchema = z.object({
  messages: z.array(workspaceMessageSchema).max(200),
  updatedAt: z.string().datetime(),
}).transform((chat) => ({
  ...chat,
  messages: chat.messages.filter(
    (message) =>
      message.role !== "assistant" ||
      !parseAiChatErrorMessage(message.content),
  ),
}));

export const workspaceSnapshotSchema = z.object({
  version: z.literal(1),
  grade: workspaceGradeSchema.nullable().optional(),
  chat: workspaceChatSchema.nullable().optional(),
});

export type WorkspaceGrade = z.infer<typeof workspaceGradeSchema>;
export type WorkspaceMessage = z.infer<typeof workspaceMessageSchema>;
export type WorkspaceChat = z.infer<typeof workspaceChatSchema>;
export type WorkspaceSnapshot = {
  grade?: WorkspaceGrade | null;
  chat?: WorkspaceChat | null;
};

const storagePrefix = "iabacu:v3:workspace";

function storageKey(examId: string, userId: string | null) {
  return userId
    ? `${storagePrefix}:${userId}:${examId}`
    : `${storagePrefix}:anonymous:${examId}`;
}

function parseSnapshot(value: string | null): WorkspaceSnapshot {
  if (!value) return {};
  try {
    const result = workspaceSnapshotSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

function newer<T extends { updatedAt: string }>(
  first?: T | null,
  second?: T | null,
): T | null | undefined {
  if (!first) return second;
  if (!second) return first;
  return first.updatedAt >= second.updatedAt ? first : second;
}

export function readWorkspace(examId: string, userId: string | null): WorkspaceSnapshot {
  const anonymous = parseSnapshot(
    readBrowserStorage(storageKey(examId, null)),
  );
  const account = userId
    ? parseSnapshot(readBrowserStorage(storageKey(examId, userId)))
    : {};
  return {
    grade: newer(anonymous.grade, account.grade),
    chat: newer(anonymous.chat, account.chat),
  };
}

export function writeWorkspace(
  examId: string,
  userId: string | null,
  update: WorkspaceSnapshot,
): WorkspaceSnapshot {
  const key = storageKey(examId, userId);
  const current = parseSnapshot(readBrowserStorage(key));
  const next = {
    grade: update.grade === undefined ? current.grade : update.grade,
    chat: update.chat === undefined ? current.chat : update.chat,
  };
  if (!next.grade && !next.chat) {
    removeBrowserStorage(key);
  } else {
    writeBrowserStorage(key, JSON.stringify({ version: 1, ...next }));
  }
  return next;
}

export async function fetchWorkspace(
  examId: string,
): Promise<WorkspaceSnapshot> {
  return readWorkspace(examId, null);
}

export async function saveWorkspace(
  examId: string,
  update: WorkspaceSnapshot,
): Promise<void> {
  writeWorkspace(examId, null, update);
}

export async function reconcileWorkspace(
  examId: string,
  userId: string,
): Promise<WorkspaceSnapshot> {
  void userId;
  return readWorkspace(examId, null);
}
