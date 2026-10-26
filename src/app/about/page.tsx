import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";

// There's one About page per side of the app (/employer/about and
// /jobseeker/about); a bare /about link goes to the visitor's own side.
export default async function AboutRedirectPage() {
  const authUser = await getAuthUser();
  redirect(authUser?.role === "jobseeker" ? "/jobseeker/about" : "/employer/about");
}
