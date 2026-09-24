// One-off: adds 5 dummy job postings to a single employer account, for
// trying out the Manage Job page with realistic data. Pass the employer's
// email as the only CLI arg. Not part of the general seed script since it
// targets one real account rather than generating fake ones.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { users, employerProfiles, jobPostings } from "../src/lib/db/schema";
import { DUMMY_JOB_POSTINGS, DUMMY_POSTING_MARKER } from "../src/lib/dummy-job-postings";

const email = process.argv[2];
if (!email) {
  console.error("Usage: tsx scripts/seed-my-jobs.ts <employer-email>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Mirrors generateUniqueJobPostingSlug in @/lib/job-postings — duplicated
// here since that file is "server-only" and can't be imported by this
// standalone script (see the top-of-file note on why this script exists).
function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

async function main() {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  const [profile] = await db
    .select({ id: employerProfiles.id, companyName: employerProfiles.companyName })
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, user.id))
    .limit(1);
  if (!profile) {
    console.error(`No employer profile found for ${email} — finish employer onboarding first.`);
    process.exit(1);
  }

  const rows = DUMMY_JOB_POSTINGS.map((p) => ({
    ...p,
    employerProfileId: profile.id,
    postingName: DUMMY_POSTING_MARKER,
    slug: slugify(`${profile.companyName}-${p.title}`) || "job",
  }));
  await db.insert(jobPostings).values(rows);
  console.log(`Inserted ${rows.length} dummy job postings for ${email}.`);
  await pool.end();
}

main();
