import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";

// One privacy page per side of the app, same pattern as /about — a bare
// /privacy link goes to the visitor's own side.
export default async function PrivacyRedirectPage() {
  const authUser = await getAuthUser();
  redirect(authUser?.role === "jobseeker" ? "/jobseeker/privacy" : "/employer/privacy");
}
