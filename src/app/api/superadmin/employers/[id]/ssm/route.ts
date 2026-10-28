import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { employerProfiles } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { revalidatePublicData } from "@/lib/public-data";
import { isSuperadminEmail } from "@/lib/superadmin";
import { isUuid } from "@/lib/uuid";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Approve/reject the SSM document an employer uploaded in onboarding or
// Company Profile — see ssmVerificationStatus on employerProfiles and the
// "Business verification" card in EmployerOnboardingForm.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [existing] = await db.select().from(employerProfiles).where(eq(employerProfiles.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!existing.ssmDocumentUrl) {
    return NextResponse.json({ error: "This company hasn't uploaded an SSM document." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { action, reason } = (body ?? {}) as Record<string, unknown>;

  if (action === "verify") {
    await db
      .update(employerProfiles)
      .set({ ssmVerificationStatus: "verified", ssmVerifiedAt: new Date(), ssmRejectionReason: null, updatedAt: new Date() })
      .where(eq(employerProfiles.id, id));
    revalidatePublicData();
    await notify([existing.userId], "employer", {
      type: "ssm_verified",
      title: "Your business is verified",
      body: `${existing.companyName}'s SSM document has been verified — a verified badge now shows on your logo.`,
      link: "/employer/company",
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (!isNonEmptyString(reason)) {
      return NextResponse.json({ error: "Give a reason for rejecting this document." }, { status: 400 });
    }
    await db
      .update(employerProfiles)
      .set({ ssmVerificationStatus: "rejected", ssmVerifiedAt: null, ssmRejectionReason: reason.trim(), updatedAt: new Date() })
      .where(eq(employerProfiles.id, id));
    revalidatePublicData();
    await notify([existing.userId], "employer", {
      type: "ssm_rejected",
      title: "Your SSM document needs another look",
      body: reason.trim(),
      link: "/employer/company",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
