import type { Metadata } from "next";
import LegalPageView from "@/components/LegalPageView";
import { getAuthUser } from "@/lib/auth-user";
import { SECURITY_POLICY } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Security · JobGiga for jobseekers",
  description: "How JobGiga protects your account and the data in it.",
};

// Public, like the /jobseeker landing page it belongs to.
export default async function JobseekerSecurityPage() {
  return <LegalPageView role="jobseeker" doc={SECURITY_POLICY} authUser={await getAuthUser()} />;
}
