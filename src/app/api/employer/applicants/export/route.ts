import { NextResponse } from "next/server";
import { buildApplicantExport, EXPORT_MAX_APPLICATIONS, type ApplicantExportRequest } from "@/lib/applicant-export";
import { getScopedEmployerAccess } from "@/lib/hiring-scope";
import { getSession } from "@/lib/session";

// Downloads applicants as an Excel file — either the exact rows on screen
// ({ applicationIds }) or an assistant search ({ filters }). Scoped like every
// applicant list: a Hiring manager or Panel member only gets their own.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const access = await getScopedEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Set up your company first." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.slice(0, 80) : undefined;
  let exportRequest: ApplicantExportRequest;
  if (Array.isArray(body.applicationIds)) {
    const ids = body.applicationIds.filter((id): id is string => typeof id === "string");
    if (ids.length === 0) return NextResponse.json({ error: "There are no applicants to export." }, { status: 400 });
    if (ids.length > EXPORT_MAX_APPLICATIONS) {
      return NextResponse.json({ error: `That's more than ${EXPORT_MAX_APPLICATIONS} applicants — filter the list first.` }, { status: 400 });
    }
    exportRequest = { applicationIds: ids, title };
  } else if (body.filters && typeof body.filters === "object" && !Array.isArray(body.filters)) {
    exportRequest = { filters: body.filters as Record<string, unknown>, title };
  } else {
    return NextResponse.json({ error: "Say which applicants to export." }, { status: 400 });
  }

  const result = await buildApplicantExport(access.profile, access.scope, exportRequest);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return new Response(new Uint8Array(result.file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
