import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { employerProfiles, jobPostings } from "@/lib/db/schema";

// Public (no auth) — deliberately so. The poster image model
// (google/gemini-3-1-flash-image via icreat, see src/lib/icreat.ts) only
// accepts reference images at a real hosted URL ending in .png/.jpg/.jpeg/
// .webp; it rejects the data: URLs employer logos are actually stored as
// (see the logoInstruction() comment in ../start/route.ts). This route
// exists purely to give icreat's servers something fetchable: it decodes
// the stored logo (whatever format it was uploaded as) and re-encodes it as
// a real PNG, so the literal .png in this route's path always matches real
// PNG bytes. Logos are already public branding shown on live job postings,
// so serving one without a session is the same exposure as the posting
// page itself.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [row] = await db
    .select({ logoUrl: employerProfiles.logoUrl })
    .from(jobPostings)
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(eq(jobPostings.id, id))
    .limit(1);

  if (!row?.logoUrl) {
    return NextResponse.json({ error: "No logo." }, { status: 404 });
  }

  // `logoUrl` is normally a `/uploads/logos/<file>` disk path now (see
  // src/lib/uploads.ts); the `data:` branch only still matters for a row
  // that predates the base64-to-disk backfill (scripts/migrate-base64-to-disk.ts)
  // or was written before this endpoint's write path was updated.
  let sourceBytes: Buffer;
  const match = /^data:([^;]+);base64,(.+)$/.exec(row.logoUrl);
  if (match) {
    sourceBytes = Buffer.from(match[2], "base64");
  } else if (row.logoUrl.startsWith("/uploads/")) {
    try {
      sourceBytes = await readFile(path.join(process.cwd(), "public", row.logoUrl));
    } catch {
      return NextResponse.json({ error: "No logo." }, { status: 404 });
    }
  } else {
    return NextResponse.json({ error: "No logo." }, { status: 404 });
  }

  try {
    const png = await sharp(sourceBytes).png().toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't read logo." }, { status: 500 });
  }
}
