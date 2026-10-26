import type { Metadata } from "next";
import AboutView from "@/components/AboutView";
import { getAuthUser } from "@/lib/auth-user";

export const metadata: Metadata = {
  title: "About · JobGiga for jobseekers",
  description:
    "JobGiga turns the resume you already have into a complete profile, so you can apply in one click and track every application.",
};

// Public, like the /jobseeker landing page it belongs to.
export default async function JobseekerAboutPage() {
  return <AboutView role="jobseeker" authUser={await getAuthUser()} />;
}
