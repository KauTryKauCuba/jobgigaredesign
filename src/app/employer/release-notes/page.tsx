import type { Metadata } from "next";
import ReleaseNotesView from "@/components/ReleaseNotesView";
import { getAuthUser } from "@/lib/auth-user";

export const metadata: Metadata = {
  title: "Release notes · JobGiga for employers",
  description: "What's changed in JobGiga for employers, newest first.",
};

// Public, like the /employer landing page it belongs to.
export default async function EmployerReleaseNotesPage() {
  return <ReleaseNotesView role="employer" authUser={await getAuthUser()} />;
}
