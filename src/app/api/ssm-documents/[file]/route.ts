import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerProfiles, users } from "@/lib/db/schema";
import { getEmployerMemberships } from "@/lib/employer-profile";
import {
  isSsmDocumentFileName,
  SSM_DOCUMENT_CONTENT_TYPES,
  ssmDocumentFilePath,
  ssmDocumentUrl,
} from "@/lib/ssm-document-storage";
import { getSession } from "@/lib/session";
import { isSuperadminEmail } from "@/lib/superadmin";
import { hasFullAccess } from "@/lib/team-roles";

// An SSM certificate is only for the company's Owners and Admins (at any
// company they belong to, not just the one currently selected) and
// superadmins reviewing it. Everyone else — Hiring managers and Panel members
// included — gets a 404, so the route doesn't reveal which files exist.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const notFound = NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isSsmDocumentFileName(file)) return notFound;

  const session = await getSession();
  if (!session) return notFound;
  // Just the email (for the superadmin check) — not the whole getAuthUser.
  const [authUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1);
  if (!authUser) return notFound;

  const [owner] = await db
    .select({ id: employerProfiles.id })
    .from(employerProfiles)
    .where(eq(employerProfiles.ssmDocumentUrl, ssmDocumentUrl(file)))
    .limit(1);
  if (!owner) return notFound;

  if (!isSuperadminEmail(authUser.email)) {
    const memberships = await getEmployerMemberships(session.userId);
    if (!memberships.some((m) => m.profile.id === owner.id && hasFullAccess(m.role))) return notFound;
  }

  try {
    const bytes = await readFile(ssmDocumentFilePath(file));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": SSM_DOCUMENT_CONTENT_TYPES[path.extname(file).slice(1)],
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound;
  }
}
