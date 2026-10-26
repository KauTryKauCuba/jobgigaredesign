import { NextResponse } from "next/server";
import { deleteTheme, listThemes, updateTheme } from "@/lib/site-themes";
import { parseThemeInput } from "@/lib/site-themes-shared";
import { isUuid } from "@/lib/uuid";
import { requireSuperadmin } from "../auth";

// Save the editor: name, colours, banner text/link, effect.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = parseThemeInput(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const theme = await updateTheme(id, parsed.value);
  if (!theme) return NextResponse.json({ error: "That theme no longer exists." }, { status: 404 });
  return NextResponse.json({ theme, themes: await listThemes() });
}

// A live theme can be deleted too — its side goes back to the default design.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id) || !(await deleteTheme(id))) {
    return NextResponse.json({ error: "That theme no longer exists." }, { status: 404 });
  }
  return NextResponse.json({ themes: await listThemes() });
}
