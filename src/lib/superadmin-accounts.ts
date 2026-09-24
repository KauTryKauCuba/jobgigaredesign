import "server-only";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { employerAddresses, employerProfiles, jobApplications, jobPostings, jobseekerProfiles, users } from "./db/schema";

export async function getJobseekersForSuperadmin() {
  const rows = await db
    .select({
      id: jobseekerProfiles.id,
      userId: users.id,
      fullName: jobseekerProfiles.fullName,
      avatarUrl: jobseekerProfiles.avatarUrl,
      email: users.email,
      phone: jobseekerProfiles.phone,
      location: jobseekerProfiles.location,
      targetRole: jobseekerProfiles.targetRole,
      createdAt: jobseekerProfiles.createdAt,
    })
    .from(jobseekerProfiles)
    .innerJoin(users, eq(jobseekerProfiles.userId, users.id))
    .orderBy(desc(jobseekerProfiles.createdAt));

  const applicationCounts = await db
    .select({ jobseekerProfileId: jobApplications.jobseekerProfileId, value: count() })
    .from(jobApplications)
    .groupBy(jobApplications.jobseekerProfileId);
  const applicationCountById = new Map(applicationCounts.map((r) => [r.jobseekerProfileId, r.value]));

  return rows.map((row) => ({ ...row, applicationCount: applicationCountById.get(row.id) ?? 0 }));
}

export async function getEmployersForSuperadmin() {
  const rows = await db
    .select({
      id: employerProfiles.id,
      userId: users.id,
      companyName: employerProfiles.companyName,
      logoUrl: employerProfiles.logoUrl,
      contactName: employerProfiles.contactName,
      contactEmail: employerProfiles.contactEmail,
      email: users.email,
      industry: employerProfiles.industry,
      location: sql<string>`(
        select ${employerAddresses.city} || ', ' || ${employerAddresses.state}
        from ${employerAddresses}
        where ${employerAddresses.employerProfileId} = ${employerProfiles.id}
        order by ${employerAddresses.createdAt} asc
        limit 1
      )`.as("location"),
      createdAt: employerProfiles.createdAt,
    })
    .from(employerProfiles)
    .innerJoin(users, eq(employerProfiles.userId, users.id))
    .orderBy(desc(employerProfiles.createdAt));

  const postingCounts = await db
    .select({ employerProfileId: jobPostings.employerProfileId, value: count() })
    .from(jobPostings)
    .groupBy(jobPostings.employerProfileId);
  const postingCountById = new Map(postingCounts.map((r) => [r.employerProfileId, r.value]));

  return rows.map((row) => ({ ...row, jobPostingCount: postingCountById.get(row.id) ?? 0 }));
}
