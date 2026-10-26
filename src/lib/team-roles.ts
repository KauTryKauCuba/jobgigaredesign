// Team roles at a company — shared by server and client (no server-only
// imports here). The two "full access" roles run the whole company account;
// the other two are scoped to part of the hiring work:
//
// - Hiring manager: the job postings they're assigned to (Post a job / Manage
//   Job / the Team page), plus any interview panel they're added to. They
//   move those applicants through the pipeline and get their notifications.
// - Panel member: only the candidates whose interview panel they're on —
//   they see the interview and the candidate, and submit their scorecard.

export const TEAM_ROLES = ["owner", "admin", "hiring_manager", "panel"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === "string" && (TEAM_ROLES as readonly string[]).includes(value);
}

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  hiring_manager: "Hiring manager",
  panel: "Panel member",
};

// What the role can do, in a line — the invite page/email, the Team page's
// role picker and the welcome step all use the same wording.
export const TEAM_ROLE_DESCRIPTION: Record<TeamRole, string> = {
  owner: "Full access, including managing other owners.",
  admin: "Post jobs, review applicants, schedule interviews and invite teammates.",
  hiring_manager: "Reviews and moves applicants for the jobs they're assigned to, and joins their interviews.",
  panel: "Joins the interviews they're added to and submits their evaluation.",
};

export const TEAM_ROLE_PILL: Record<TeamRole, { bg: string; text: string }> = {
  owner: { bg: "bg-[#FFF3D6]", text: "text-[#A67C00]" },
  admin: { bg: "bg-[#E6F9FA]", text: "text-[#008990]" },
  hiring_manager: { bg: "bg-[#EAF0FE]", text: "text-[#3B5BDB]" },
  panel: { bg: "bg-[#F1ECFB]", text: "text-[#7C5CD1]" },
};

/** Owners and Admins — the whole company account (jobs, team, company profile, ads). */
export function hasFullAccess(role: TeamRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Where this role's dashboard starts — a Panel member has no jobs or applicants list of their own. */
export function employerHomePath(role: TeamRole | null | undefined): string {
  return role === "panel" ? "/employer/interviews" : "/employer/dashboard";
}
