import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";

// One security page per side of the app, same pattern as /about — a bare
// /security link goes to the visitor's own side.
export default async function SecurityRedirectPage() {
  const authUser = await getAuthUser();
  redirect(authUser?.role === "jobseeker" ? "/jobseeker/security" : "/employer/security");
}
