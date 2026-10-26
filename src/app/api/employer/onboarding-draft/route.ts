import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerOnboardingDrafts } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { saveSsmDocument } from "@/lib/ssm-document-storage";
import { isBase64DataUrl, saveBannerUpload, saveBase64Upload } from "@/lib/uploads";

// This draft is a free-form JSON blob of the whole in-progress onboarding
// form, autosaved on every field change — including whichever files have
// been picked so far. Each freshly picked file (a `data:` URL) is saved here,
// once, and its stored path sent back so the form uses that from then on:
// otherwise every later autosave would resend — and re-save — the same file,
// and the multi-MB data would sit in Postgres. Saving the cover banner and
// SSM document here too is what lets them survive a page refresh.
type FileField = {
  // Same type/size limits /api/employer/profile applies on Finish.
  accepts: RegExp;
  maxLength: number;
  save: (dataUrl: string) => Promise<string>;
};
const FILE_FIELDS: Record<string, FileField> = {
  avatarUrl: { accepts: /^data:image\//, maxLength: 6_000_000, save: (v) => saveBase64Upload(v, "avatars") },
  logoUrl: { accepts: /^data:image\//, maxLength: 6_000_000, save: (v) => saveBase64Upload(v, "logos") },
  officePhotoUrl: {
    accepts: /^data:image\//,
    maxLength: 6_000_000,
    save: (v) => saveBase64Upload(v, "office-photos"),
  },
  bannerUrl: { accepts: /^data:image\//, maxLength: 14_000_000, save: saveBannerUpload },
  ssmDocumentUrl: {
    accepts: /^data:(application\/pdf|image\/(jpeg|png|webp));base64,/,
    maxLength: 14_000_000,
    save: saveSsmDocument,
  },
};

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const [draft] = await db
    .select({ data: employerOnboardingDrafts.data })
    .from(employerOnboardingDrafts)
    .where(eq(employerOnboardingDrafts.userId, session.userId))
    .limit(1);

  return NextResponse.json({ draft: draft?.data ?? null });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return NextResponse.json({ error: "Invalid draft data." }, { status: 400 });
  }

  const [existing] = await db
    .select({ data: employerOnboardingDrafts.data })
    .from(employerOnboardingDrafts)
    .where(eq(employerOnboardingDrafts.userId, session.userId))
    .limit(1);
  const previousSsmDocumentUrl = (existing?.data as Record<string, unknown> | undefined)?.ssmDocumentUrl ?? null;

  const draft = { ...(data as Record<string, unknown>) };
  // What each freshly picked file was saved as, for the form to swap in.
  const resolved: Record<string, string | null> = {};
  for (const [field, { accepts, maxLength, save }] of Object.entries(FILE_FIELDS)) {
    const value = draft[field];
    if (!isBase64DataUrl(value)) continue;
    let saved: string | null = null;
    if (accepts.test(value) && value.length <= maxLength) {
      try {
        saved = await save(value);
      } catch {
        // Unreadable file — dropped rather than kept as a data URL.
      }
    }
    draft[field] = saved;
    resolved[field] = saved;
  }

  // Finish accepts the draft's SSM document as this user's own upload (see
  // /api/employer/profile), so the draft may only hold one this user actually
  // uploaded through it — never a URL pointing at someone else's certificate.
  if (
    typeof draft.ssmDocumentUrl === "string" &&
    !("ssmDocumentUrl" in resolved) &&
    draft.ssmDocumentUrl !== previousSsmDocumentUrl
  ) {
    draft.ssmDocumentUrl = null;
  }

  await db
    .insert(employerOnboardingDrafts)
    .values({ userId: session.userId, data: draft, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: employerOnboardingDrafts.userId,
      set: { data: draft, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true, resolved });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  await db.delete(employerOnboardingDrafts).where(eq(employerOnboardingDrafts.userId, session.userId));

  return NextResponse.json({ ok: true });
}
