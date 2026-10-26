import type { Metadata } from "next";
import LegalPageView from "@/components/LegalPageView";
import { getAuthUser } from "@/lib/auth-user";
import { PRIVACY_POLICY } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy · JobGiga for employers",
  description: "What JobGiga collects, why, and what you can do about it.",
};

// Public, like the /employer landing page it belongs to.
export default async function EmployerPrivacyPage() {
  return <LegalPageView role="employer" doc={PRIVACY_POLICY} authUser={await getAuthUser()} />;
}
