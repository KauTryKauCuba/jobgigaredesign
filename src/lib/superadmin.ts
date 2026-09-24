import "server-only";

// Superadmin access is an email allowlist layered on top of a normal
// employer/jobseeker sign-in — not a third `role` in the schema/session.
// There's only ever a couple of people reviewing postings, so a real role
// (with its own onboarding/redirect wiring) would be scope this doesn't need.
const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPERADMIN_EMAILS.includes(email.toLowerCase());
}
