// One-off: deletes every real (non-dummy) user and cascades their data,
// while preserving the dummy job postings (DUMMY_POSTING_MARKER) and dummy
// applicants (DUMMY_APPLICANT_EMAIL_DOMAIN) created by the "Get dummy data"
// buttons. Does not use `@/lib/db` since that module imports `server-only`,
// which only resolves inside Next's build (same reason clear-db.ts avoids it).
import { Pool } from "pg";
import { DUMMY_POSTING_MARKER } from "../src/lib/dummy-job-postings";
import { DUMMY_APPLICANT_EMAIL_DOMAIN } from "../src/lib/dummy-applicants";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Employer accounts that own at least one dummy job posting — keep
    // these so the dummy postings survive (job_postings.employer_profile_id
    // has no cascade path that would let us keep the posting without also
    // keeping its owning employer_profile / user).
    const { rows: keepEmployerUsers } = await client.query<{ user_id: string }>(
      `SELECT DISTINCT ep.user_id
       FROM employer_profiles ep
       JOIN job_postings jp ON jp.employer_profile_id = ep.id
       WHERE jp.posting_name = $1`,
      [DUMMY_POSTING_MARKER],
    );
    const { rows: keepEmployerProfiles } = await client.query<{ id: string }>(
      `SELECT DISTINCT ep.id
       FROM employer_profiles ep
       JOIN job_postings jp ON jp.employer_profile_id = ep.id
       WHERE jp.posting_name = $1`,
      [DUMMY_POSTING_MARKER],
    );

    // Dummy applicant accounts.
    const { rows: keepJobseekerUsers } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email LIKE $1`,
      [`%@${DUMMY_APPLICANT_EMAIL_DOMAIN}`],
    );
    const { rows: keepJobseekerProfiles } = await client.query<{ id: string }>(
      `SELECT jp.id FROM jobseeker_profiles jp
       JOIN users u ON u.id = jp.user_id
       WHERE u.email LIKE $1`,
      [`%@${DUMMY_APPLICANT_EMAIL_DOMAIN}`],
    );

    const keepEmployerProfileIds = keepEmployerProfiles.map((r) => r.id);
    const keepJobseekerProfileIds = keepJobseekerProfiles.map((r) => r.id);
    const keepUserIds = [
      ...keepEmployerUsers.map((r) => r.user_id),
      ...keepJobseekerUsers.map((r) => r.id),
    ];

    console.log(`Keeping ${keepEmployerProfileIds.length} employer profile(s) that own dummy postings.`);
    console.log(`Keeping ${keepJobseekerProfileIds.length} dummy applicant profile(s).`);

    // Deleting a profile cascades everything hanging off it (job postings,
    // applications, education, certifications, etc.) per schema.ts's
    // onDelete: "cascade" chains — only the profile→user link itself has no
    // cascade, so users are deleted last, explicitly.
    if (keepEmployerProfileIds.length > 0) {
      await client.query(`DELETE FROM employer_profiles WHERE id NOT IN (${keepEmployerProfileIds.map((_, i) => `$${i + 1}`).join(",")})`, keepEmployerProfileIds);
    } else {
      await client.query(`DELETE FROM employer_profiles`);
    }

    if (keepJobseekerProfileIds.length > 0) {
      await client.query(`DELETE FROM jobseeker_profiles WHERE id NOT IN (${keepJobseekerProfileIds.map((_, i) => `$${i + 1}`).join(",")})`, keepJobseekerProfileIds);
    } else {
      await client.query(`DELETE FROM jobseeker_profiles`);
    }

    if (keepUserIds.length > 0) {
      await client.query(`DELETE FROM users WHERE id NOT IN (${keepUserIds.map((_, i) => `$${i + 1}`).join(",")})`, keepUserIds);
    } else {
      await client.query(`DELETE FROM users`);
    }

    // Onboarding drafts and OTP codes aren't tied to anything worth keeping.
    await client.query(`DELETE FROM otp_codes`);

    await client.query("COMMIT");
    console.log("Done — real data cleared, dummy data preserved.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
