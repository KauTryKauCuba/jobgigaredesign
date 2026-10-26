import { claimsCsv } from "@/lib/campaigns";
import { handle, notAuthorized, requireSuperadmin } from "../../../auth";

// Everyone who claimed, as a spreadsheet (opens in Excel / Google Sheets).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  return handle(async () => {
    const { filename, csv } = await claimsCsv(id);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
