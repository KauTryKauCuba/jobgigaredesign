import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";

// One terms page per side of the app, same pattern as /about — a bare
// /terms link goes to the visitor's own side.
export default async function TermsRedirectPage() {
  const authUser = await getAuthUser();
  redirect(authUser?.role === "jobseeker" ? "/jobseeker/terms" : "/employer/terms");
}
