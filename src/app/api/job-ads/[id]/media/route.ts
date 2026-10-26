import { eq } from "drizzle-orm";
import { canSeeUnreviewedAd, serveAdMedia } from "@/lib/ad-media";
import { db } from "@/lib/db";
import { jobAds } from "@/lib/db/schema";
import { jobAdFilePath } from "@/lib/job-ads";
import { isUuid } from "@/lib/uuid";

/**
 * A job ad's artwork. Approved ads are public (they're on the jobseeker
 * page); a pending or rejected one is only for the company's own team and
 * superadmins.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = new Response("Not found.", { status: 404 });
  if (!isUuid(id)) return notFound;

  const [ad] = await db.select().from(jobAds).where(eq(jobAds.id, id)).limit(1);
  if (!ad) return notFound;

  const isPublic = ad.status === "approved";
  if (!isPublic && !(await canSeeUnreviewedAd(ad.employerProfileId))) return notFound;

  return serveAdMedia(request, { filePath: jobAdFilePath(ad.fileName), mediaType: ad.mediaType, isPublic });
}
