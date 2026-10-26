import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { employerProfiles, employerTeamMembers, users } from "./db/schema";
import {
  isSalaryPeriod,
  isStartAvailability,
  MAX_POSTING_BENEFITS,
  MAX_WORKING_HOURS_LENGTH,
  type SalaryPeriod,
  type StartAvailability,
} from "./job-posting-options";
import type { PostingContact } from "./posting-contact-types";

// Validation and lookups for a job posting's hybrid office days, salary period/visibility,
// benefits, start date, working hours and contact person — shared by the create and update routes and the
// jobseeker-facing pages.

export type PostingExtras = {
  officeDaysPerWeek?: number | null;
  salaryPeriod?: SalaryPeriod;
  showSalary?: boolean;
  benefits?: string[];
  startAvailability?: StartAvailability | null;
  workingHours?: string | null;
  contactUserId?: string | null;
};

/**
 * Checks whichever of these fields are present in a request body (absent
 * ones are left out, so an update only touches what was sent). The contact
 * must be an active member of this company's team.
 */
export async function parsePostingExtras(
  body: Record<string, unknown>,
  company: { id: string; ownerUserId: string },
): Promise<{ ok: true; values: PostingExtras } | { ok: false; error: string }> {
  const values: PostingExtras = {};

  if (body.benefits !== undefined) {
    if (!Array.isArray(body.benefits) || !body.benefits.every((b) => typeof b === "string")) {
      return { ok: false, error: "Invalid benefits." };
    }
    const seen = new Set<string>();
    values.benefits = (body.benefits as string[])
      .map((b) => b.trim().slice(0, 60))
      .filter((b) => b && !seen.has(b.toLowerCase()) && seen.add(b.toLowerCase()))
      .slice(0, MAX_POSTING_BENEFITS);
  }

  if (body.officeDaysPerWeek !== undefined) {
    const days = body.officeDaysPerWeek;
    if (days === null || days === "") values.officeDaysPerWeek = null;
    else if (typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 4) {
      values.officeDaysPerWeek = days;
    } else return { ok: false, error: "Invalid office days." };
  }

  if (body.salaryPeriod !== undefined) {
    if (!isSalaryPeriod(body.salaryPeriod)) return { ok: false, error: "Invalid salary period." };
    values.salaryPeriod = body.salaryPeriod;
  }

  if (body.showSalary !== undefined) {
    if (typeof body.showSalary !== "boolean") return { ok: false, error: "Invalid salary visibility." };
    values.showSalary = body.showSalary;
  }

  if (body.startAvailability !== undefined) {
    if (body.startAvailability === null || body.startAvailability === "") values.startAvailability = null;
    else if (isStartAvailability(body.startAvailability)) values.startAvailability = body.startAvailability;
    else return { ok: false, error: "Invalid start date option." };
  }

  if (body.workingHours !== undefined) {
    if (body.workingHours !== null && typeof body.workingHours !== "string") {
      return { ok: false, error: "Invalid working hours." };
    }
    const hours = (body.workingHours ?? "").trim();
    if (hours.length > MAX_WORKING_HOURS_LENGTH) {
      return { ok: false, error: `Keep working hours under ${MAX_WORKING_HOURS_LENGTH} characters.` };
    }
    values.workingHours = hours || null;
  }

  if (body.contactUserId !== undefined) {
    if (body.contactUserId === null || body.contactUserId === "") {
      values.contactUserId = null;
    } else if (typeof body.contactUserId !== "string") {
      return { ok: false, error: "Invalid contact person." };
    } else if (body.contactUserId === company.ownerUserId) {
      values.contactUserId = body.contactUserId;
    } else {
      const [member] = await db
        .select({ id: employerTeamMembers.id })
        .from(employerTeamMembers)
        .where(
          and(
            eq(employerTeamMembers.employerProfileId, company.id),
            eq(employerTeamMembers.userId, body.contactUserId),
            eq(employerTeamMembers.status, "active"),
          ),
        )
        .limit(1);
      // Not (or no longer) on the team — e.g. duplicating an old posting whose
      // contact has since left: show no contact rather than fail the save.
      values.contactUserId = member ? body.contactUserId : null;
    }
  }

  return { ok: true, values };
}

export type { PostingContact };

/**
 * The contact shown on each posting, keyed `${employerProfileId}:${userId}`.
 * Only public details (name, position, photo). Someone no longer on the
 * company's team is left out, so a posting never shows a departed contact.
 */
export async function getPostingContacts(
  postings: { employerProfileId: string; contactUserId: string | null }[],
): Promise<Map<string, PostingContact>> {
  const result = new Map<string, PostingContact>();
  const wanted = postings.filter((p): p is { employerProfileId: string; contactUserId: string } => !!p.contactUserId);
  if (wanted.length === 0) return result;

  const companyIds = [...new Set(wanted.map((p) => p.employerProfileId))];
  const userIds = [...new Set(wanted.map((p) => p.contactUserId))];

  const [companies, members] = await Promise.all([
    db
      .select({
        id: employerProfiles.id,
        ownerUserId: employerProfiles.userId,
        contactName: employerProfiles.contactName,
        contactPosition: employerProfiles.contactPosition,
        avatarUrl: employerProfiles.avatarUrl,
      })
      .from(employerProfiles)
      .where(inArray(employerProfiles.id, companyIds)),
    db
      .select({
        employerProfileId: employerTeamMembers.employerProfileId,
        userId: employerTeamMembers.userId,
        position: employerTeamMembers.position,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(employerTeamMembers)
      .innerJoin(users, eq(users.id, employerTeamMembers.userId))
      .where(
        and(
          inArray(employerTeamMembers.employerProfileId, companyIds),
          inArray(employerTeamMembers.userId, userIds),
          eq(employerTeamMembers.status, "active"),
        ),
      ),
  ]);

  for (const p of wanted) {
    const company = companies.find((c) => c.id === p.employerProfileId);
    if (!company) continue;
    const key = `${p.employerProfileId}:${p.contactUserId}`;
    if (company.ownerUserId === p.contactUserId) {
      // The company's registrant goes by their employer contact details.
      result.set(key, { name: company.contactName, position: company.contactPosition, avatarUrl: company.avatarUrl });
      continue;
    }
    const member = members.find((m) => m.employerProfileId === p.employerProfileId && m.userId === p.contactUserId);
    if (member) {
      result.set(key, {
        name: member.name || member.email.split("@")[0],
        position: member.position,
        avatarUrl: member.avatarUrl,
      });
    }
  }
  return result;
}
