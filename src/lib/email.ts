import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
  client ??= new Resend(apiKey);
  return client;
}

export async function sendOtpEmail(email: string, code: string) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set.");

  // The SDK resolves with { data, error } instead of rejecting on API
  // errors (e.g. sending to an address the account isn't allowed to send
  // to yet) — checking `error` is required, or failed sends look like
  // successes to every caller.
  const { error } = await getClient().emails.send({
    from,
    to: email,
    subject: `${code} is your JobGiga verification code`,
    text: `Your JobGiga verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
        <p style="font-size:14px;color:#4B5468">Your JobGiga verification code is:</p>
        <p style="font-size:32px;font-weight:600;letter-spacing:6px;color:#141B2E;margin:12px 0">${code}</p>
        <p style="font-size:13px;color:#9AA3B2">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}

const ROLE_LABEL: Record<"owner" | "admin", string> = { owner: "Owner", admin: "Admin" };

export async function sendTeamInviteEmail(
  email: string,
  companyName: string,
  inviterLabel: string,
  role: "owner" | "admin",
) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const roleLabel = ROLE_LABEL[role] ?? role;

  const { error } = await getClient().emails.send({
    from,
    to: email,
    subject: `${inviterLabel} invited you to join ${companyName} on JobGiga`,
    text: `${inviterLabel} invited you to join ${companyName} on JobGiga as ${roleLabel}.\n\nSign in with this email address (${email}) to accept: ${siteUrl}\n\nIf you weren't expecting this, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
        <p style="font-size:14px;color:#4B5468">${inviterLabel} invited you to join <strong>${companyName}</strong> on JobGiga as <strong>${roleLabel}</strong>.</p>
        <p style="font-size:14px;color:#4B5468">Sign in with this email address (${email}) to accept the invite.</p>
        <p style="margin:20px 0">
          <a href="${siteUrl}" style="display:inline-block;background:#141B2E;color:#fff;text-decoration:none;font-size:14px;padding:10px 20px;border-radius:999px">Go to JobGiga</a>
        </p>
        <p style="font-size:13px;color:#9AA3B2">If you weren't expecting this, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}
