ALTER TABLE "job_applications" ADD COLUMN "screening_answers" jsonb;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "screening_eligible" boolean;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "screening_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Postings created before this flag existed may already have real
-- screening requirement values set (min experience, qualification tier,
-- languages, work authorizations, driving license, or custom questions).
-- Without this backfill, the API's "screening off wipes requirement
-- fields" rule (src/app/api/employer/job-postings/[id]/route.ts) would
-- silently delete that pre-existing data the very next time any one of
-- these postings is updated for an unrelated reason (e.g. just closing it).
UPDATE "job_postings" SET "screening_enabled" = true
WHERE "min_years_experience" IS NOT NULL
   OR "min_qualification_tier" IS NOT NULL
   OR "driving_license" IS NOT NULL
   OR jsonb_array_length("languages") > 0
   OR array_length("work_authorizations", 1) > 0
   OR jsonb_array_length("custom_screening_questions") > 0;