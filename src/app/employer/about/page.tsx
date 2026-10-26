import type { Metadata } from "next";
import AboutView from "@/components/AboutView";
import { getAuthUser } from "@/lib/auth-user";

export const metadata: Metadata = {
  title: "About · JobGiga for employers",
  description:
    "JobGiga helps Malaysian employers hire with an AI assistant that sets up your company, writes your job posts and organises your applicants.",
};

// Public, like the /employer landing page it belongs to.
export default async function EmployerAboutPage() {
  return <AboutView role="employer" authUser={await getAuthUser()} />;
}
