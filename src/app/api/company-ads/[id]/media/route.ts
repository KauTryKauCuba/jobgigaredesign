import { eq } from "drizzle-orm";
import { canSeeUnreviewedAd, serveAdMedia } from "@/lib/ad-media";
import { companyAdFilePath } from "@/lib/company-ads";
import { db } from "@/lib/db";
import { companyAds } from "@/lib/db/schema";
import { isUuid } from "@/lib/uuid";

/**
 * An ad's image or video. Approved ads are public (they're on the landing
 * page); a pending or rejected one is only for the company's own team and
 * superadmins.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = new Response("Not found.", { status: 404 });
  if (!isUuid(id)) return notFound;

  const [ad] = await db.select().from(companyAds).where(eq(companyAds.id, id)).limit(1);
  if (!ad) return notFound;

  const isPublic = ad.status === "approved";
  if (!isPublic && !(await canSeeUnreviewedAd(ad.employerProfileId))) return notFound;

  return serveAdMedia(request, { filePath: companyAdFilePath(ad.fileName), mediaType: ad.mediaType, isPublic });
}
