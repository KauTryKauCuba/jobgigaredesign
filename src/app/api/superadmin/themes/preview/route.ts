import { NextResponse } from "next/server";
import { getTheme, THEME_PREVIEW_COOKIE } from "@/lib/site-themes";
import { requireSuperadmin } from "../auth";

// "Preview on site": for this superadmin's browser only, that side of the
// site shows the theme (live or not) until they exit. JSON: { id }.
export async function POST(request: Request) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const theme = typeof body?.id === "string" ? await getTheme(body.id) : null;
  if (!theme) return NextResponse.json({ error: "That theme no longer exists." }, { status: 404 });

  const res = NextResponse.json({ ok: true, page: theme.audience === "employer" ? "/employer" : "/jobseeker" });
  res.cookies.set(THEME_PREVIEW_COOKIE, theme.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 2,
  });
  return res;
}

export async function DELETE() {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(THEME_PREVIEW_COOKIE);
  return res;
}
