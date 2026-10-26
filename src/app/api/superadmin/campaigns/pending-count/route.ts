import { NextResponse } from "next/server";
import { pendingApprovalCount } from "@/lib/campaigns";
import { notAuthorized, requireSuperadmin } from "../auth";

// The number on the sidebar's Campaigns item: rewards waiting for approval.
export async function GET() {
  if (!(await requireSuperadmin())) return notAuthorized();
  return NextResponse.json({ count: await pendingApprovalCount() });
}
