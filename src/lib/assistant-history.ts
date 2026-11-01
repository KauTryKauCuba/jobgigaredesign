import "server-only";
import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import type {
  AssistantAction,
  AssistantConversationSummary,
  AssistantMessage,
  AssistantMessageStats,
  SimpleActionResolution,
  StageChangeResolution,
} from "./assistant-types";
import { db } from "./db";
import { assistantConversations, assistantMessages } from "./db/schema";
import { getEmployerAccess } from "./employer-profile";
import { getSession } from "./session";

// Chats older than this (by last activity) are deleted the next time the
// user opens their chat list — no background job needed.
const RETENTION_DAYS = 90;
const LIST_LIMIT = 50;

// Which conversations a user can see right now: their own, held under the
// role they're currently signed in as — and for employers, under the
// company they're currently viewing, since answers were about that company.
export type ChatScope = { userId: string; role: "employer" | "jobseeker"; employerProfileId: string | null };

function scopeFilter(scope: ChatScope) {
  return and(
    eq(assistantConversations.userId, scope.userId),
    eq(assistantConversations.role, scope.role),
    scope.employerProfileId
      ? eq(assistantConversations.employerProfileId, scope.employerProfileId)
      : isNull(assistantConversations.employerProfileId),
  );
}

export function titleFrom(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57).trimEnd()}…` : oneLine;
}

export async function listConversations(scope: ChatScope): Promise<AssistantConversationSummary[]> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  await db
    .delete(assistantConversations)
    .where(and(eq(assistantConversations.userId, scope.userId), lt(assistantConversations.updatedAt, cutoff)));

  const rows = await db
    .select({ id: assistantConversations.id, title: assistantConversations.title, updatedAt: assistantConversations.updatedAt })
    .from(assistantConversations)
    .where(scopeFilter(scope))
    .orderBy(desc(assistantConversations.updatedAt))
    .limit(LIST_LIMIT);
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

export async function conversationExists(scope: ChatScope, conversationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: assistantConversations.id })
    .from(assistantConversations)
    .where(and(scopeFilter(scope), eq(assistantConversations.id, conversationId)))
    .limit(1);
  return !!row;
}

export async function getConversationMessages(scope: ChatScope, conversationId: string): Promise<AssistantMessage[] | null> {
  if (!(await conversationExists(scope, conversationId))) return null;
  const rows = await db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.conversationId, conversationId))
    .orderBy(asc(assistantMessages.createdAt));
  return rows.map((r) => ({ id: r.id, role: r.role, text: r.content, action: r.action ?? null, stats: r.stats ?? null }));
}

export async function createConversation(scope: ChatScope, firstMessage: string): Promise<string> {
  const [row] = await db
    .insert(assistantConversations)
    .values({ userId: scope.userId, role: scope.role, employerProfileId: scope.employerProfileId, title: titleFrom(firstMessage) })
    .returning({ id: assistantConversations.id });
  return row.id;
}

export async function appendMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  action: AssistantAction | null = null,
  stats: AssistantMessageStats | null = null,
): Promise<string> {
  const [row] = await db
    .insert(assistantMessages)
    .values({ conversationId, role, content, action, stats })
    .returning({ id: assistantMessages.id });
  await db.update(assistantConversations).set({ updatedAt: new Date() }).where(eq(assistantConversations.id, conversationId));
  return row.id;
}

export async function deleteConversation(scope: ChatScope, conversationId: string): Promise<boolean> {
  const deleted = await db
    .delete(assistantConversations)
    .where(and(scopeFilter(scope), eq(assistantConversations.id, conversationId)))
    .returning({ id: assistantConversations.id });
  return deleted.length > 0;
}

// Same idea for a stage-change card: Confirmed (with each move's result) or
// Cancelled, so it never offers its buttons twice.
export async function setStageChangeResolution(
  scope: ChatScope,
  messageId: string,
  resolution: StageChangeResolution,
  results: Record<string, string>,
): Promise<boolean> {
  const [row] = await db
    .select({ action: assistantMessages.action, conversationId: assistantMessages.conversationId })
    .from(assistantMessages)
    .where(eq(assistantMessages.id, messageId))
    .limit(1);
  if (!row || row.action?.type !== "change_stage") return false;
  // Answered once — except that a confirmed card can later be undone.
  const current = row.action.resolution;
  if (current && !(current === "done" && resolution === "undone")) return false;
  if (!(await conversationExists(scope, row.conversationId))) return false;
  // Only results for applicants that were actually on the card are kept.
  const onCard = new Set(row.action.items.map((i) => i.applicationId));
  const kept = Object.fromEntries(
    Object.entries(results)
      .filter(([id, value]) => onCard.has(id) && typeof value === "string")
      .map(([id, value]) => [id, value.slice(0, 200)]),
  );
  await db
    .update(assistantMessages)
    .set({ action: { ...row.action, resolution, results: kept } })
    .where(eq(assistantMessages.id, messageId));
  return true;
}

// Same idea for schedule_interview / cancel_interview / record_evaluation /
// close_posting / create_job_posting — each is a single-card action,
// answered once, with no per-item results. create_job_posting's `extra`
// carries back the newly saved draft's id, so reopening the chat still
// links to it instead of just showing "created".
export async function setSimpleActionResolution(
  scope: ChatScope,
  messageId: string,
  type: "schedule_interview" | "cancel_interview" | "record_evaluation" | "close_posting" | "create_job_posting",
  resolution: SimpleActionResolution,
  extra?: Record<string, unknown>,
): Promise<boolean> {
  const [row] = await db
    .select({ action: assistantMessages.action, conversationId: assistantMessages.conversationId })
    .from(assistantMessages)
    .where(eq(assistantMessages.id, messageId))
    .limit(1);
  if (!row || row.action?.type !== type) return false;
  if (row.action.resolution) return false;
  if (!(await conversationExists(scope, row.conversationId))) return false;
  await db
    .update(assistantMessages)
    .set({ action: { ...row.action, ...extra, resolution } })
    .where(eq(assistantMessages.id, messageId));
  return true;
}

export async function getChatScope(): Promise<ChatScope | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "employer") {
    const access = await getEmployerAccess(session.userId);
    return { userId: session.userId, role: "employer", employerProfileId: access?.profile.id ?? null };
  }
  return { userId: session.userId, role: "jobseeker", employerProfileId: null };
}
