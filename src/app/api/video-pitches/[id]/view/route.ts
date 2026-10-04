import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { recordPitchView, resolvePitchAccess } from "@/lib/video-pitch";

// An employer started watching a pitch — marks it "Watched" for their
// company and (on their company's first watch) notifies the jobseeker.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const { id } = await params;
  const access = await resolvePitchAccess(id, session);
  if (!access.ok || access.viewer !== "employer") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  await recordPitchView({ pitch: access.pitch, employerProfileId: access.employerProfileId, viewerUserId: session.userId });
  return NextResponse.json({ ok: true });
}
