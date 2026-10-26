import type { Metadata } from "next";
import LegalPageView from "@/components/LegalPageView";
import { getAuthUser } from "@/lib/auth-user";
import { TERMS_AND_CONDITIONS } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Terms & Conditions · JobGiga for jobseekers",
  description: "The basics of using JobGiga, for employers and jobseekers alike.",
};

// Public, like the /jobseeker landing page it belongs to.
export default async function JobseekerTermsPage() {
  return <LegalPageView role="jobseeker" doc={TERMS_AND_CONDITIONS} authUser={await getAuthUser()} />;
}
