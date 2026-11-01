import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobseekerProfiles } from "@/lib/db/schema";
import { loadResumeFile } from "@/lib/resume-review";
import { getSession } from "@/lib/session";

// The signed-in jobseeker's own resume, for Resume Review's viewer — served
// the same way whether it's stored as a file or as an older inline data URL.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") return new Response("Not found.", { status: 404 });

  const [profile] = await db
    .select({ resumeUrl: jobseekerProfiles.resumeUrl, resumeFileName: jobseekerProfiles.resumeFileName })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, session.userId))
    .limit(1);
  const file = await loadResumeFile(profile?.resumeUrl ?? null);
  if (!file) return new Response("Not found.", { status: 404 });

  const name = (profile?.resumeFileName ?? "resume").replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
