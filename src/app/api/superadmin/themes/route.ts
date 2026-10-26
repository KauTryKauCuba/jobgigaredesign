import { NextResponse } from "next/server";
import { createTheme, listThemes } from "@/lib/site-themes";
import { findPreset, THEME_AUDIENCES } from "@/lib/site-themes-shared";
import { requireSuperadmin } from "./auth";

export async function GET() {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  return NextResponse.json({ themes: await listThemes() });
}

// A new, switched-off theme. JSON: { audience, presetKey } — presetKey null
// starts from the current design (a custom theme).
export async function POST(request: Request) {
  const admin = await requireSuperadmin();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const audience = THEME_AUDIENCES.find((a) => a === body?.audience);
  if (!audience) return NextResponse.json({ error: "Choose employer or jobseeker." }, { status: 400 });
  const presetKey = body?.presetKey ?? null;
  if (presetKey !== null && !findPreset(presetKey)) {
    return NextResponse.json({ error: "That ready-made theme doesn't exist." }, { status: 400 });
  }

  const theme = await createTheme(audience, presetKey, admin.id);
  return NextResponse.json({ theme, themes: await listThemes() });
}
