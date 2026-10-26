import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";

// One release-notes page per side of the app (/employer/release-notes and
// /jobseeker/release-notes), same pattern as /about — a bare /release-notes
// link goes to the visitor's own side.
export default async function ReleaseNotesRedirectPage() {
  const authUser = await getAuthUser();
  redirect(authUser?.role === "jobseeker" ? "/jobseeker/release-notes" : "/employer/release-notes");
}
