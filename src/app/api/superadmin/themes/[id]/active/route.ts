import { NextResponse } from "next/server";
import { listThemes, setThemeActive } from "@/lib/site-themes";
import { isUuid } from "@/lib/uuid";
import { requireSuperadmin } from "../../auth";

// The on/off switch. JSON: { active: boolean } — turning one on turns off
// whichever theme was live on the same side.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const theme = await setThemeActive(id, body.active);
    if (!theme) return NextResponse.json({ error: "That theme no longer exists." }, { status: 404 });
  } catch {
    // Two switches flipped at the same moment — the one-live-per-side index wins.
    return NextResponse.json({ error: "Another theme was just turned on — refresh and try again." }, { status: 409 });
  }
  return NextResponse.json({ themes: await listThemes() });
}
