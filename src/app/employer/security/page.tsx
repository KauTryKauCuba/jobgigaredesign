import type { Metadata } from "next";
import LegalPageView from "@/components/LegalPageView";
import { getAuthUser } from "@/lib/auth-user";
import { SECURITY_POLICY } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Security · JobGiga for employers",
  description: "How JobGiga protects your account and the data in it.",
};

// Public, like the /employer landing page it belongs to.
export default async function EmployerSecurityPage() {
  return <LegalPageView role="employer" doc={SECURITY_POLICY} authUser={await getAuthUser()} />;
}
