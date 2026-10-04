import { NextResponse } from "next/server";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

const LIST_LIMIT = 30;

// The signed-in user's latest notifications for the side of the app they're
// currently on, plus how many are unread (for the bell's badge).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const scope = and(eq(notifications.userId, session.userId), eq(notifications.audience, session.role));
  const [items, [{ unread }]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(scope)
      .orderBy(desc(notifications.createdAt))
      .limit(LIST_LIMIT),
    db.select({ unread: count() }).from(notifications).where(and(scope, isNull(notifications.readAt))),
  ]);

  return NextResponse.json({ notifications: items, unreadCount: unread });
}

// Mark as read: `{ ids: [...] }` for specific ones, or `{ all: true }`.
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { ids, all } = (body ?? {}) as Record<string, unknown>;
  const scope = and(
    eq(notifications.userId, session.userId),
    eq(notifications.audience, session.role),
    isNull(notifications.readAt),
  );

  if (all === true) {
    await db.update(notifications).set({ readAt: new Date() }).where(scope);
  } else if (Array.isArray(ids) && ids.length > 0 && ids.every(isUuid)) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(scope, inArray(notifications.id, ids as string[])));
  } else {
    return NextResponse.json({ error: "Pass `ids` or `all: true`." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
