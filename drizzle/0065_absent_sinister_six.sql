ALTER TABLE "job_postings" ADD COLUMN "custom_screening_questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Postings created before the screening_enabled flag (added in
-- 0064_dapper_giant_girl.sql) existed may already have real screening
-- requirement values set (min experience, qualification tier, languages,
-- work authorizations, driving license, or custom questions — the column
-- for the last one didn't exist until the statement above, which is why
-- this backfill lives here and not in 0064 alongside the flag itself).
-- Without this, the API's "screening off wipes requirement fields" rule
-- (src/app/api/employer/job-postings/[id]/route.ts) would silently delete
-- that pre-existing data the very next time any one of these postings is
-- updated for an unrelated reason (e.g. just closing it).
UPDATE "job_postings" SET "screening_enabled" = true
WHERE "min_years_experience" IS NOT NULL
   OR "min_qualification_tier" IS NOT NULL
   OR "driving_license" IS NOT NULL
   OR jsonb_array_length("languages") > 0
   OR array_length("work_authorizations", 1) > 0
   OR jsonb_array_length("custom_screening_questions") > 0;