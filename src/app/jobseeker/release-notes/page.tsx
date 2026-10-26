import type { Metadata } from "next";
import ReleaseNotesView from "@/components/ReleaseNotesView";
import { getAuthUser } from "@/lib/auth-user";

export const metadata: Metadata = {
  title: "Release notes · JobGiga for jobseekers",
  description: "What's changed in JobGiga for jobseekers, newest first.",
};

// Public, like the /jobseeker landing page it belongs to.
export default async function JobseekerReleaseNotesPage() {
  return <ReleaseNotesView role="jobseeker" authUser={await getAuthUser()} />;
}
