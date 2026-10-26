ALTER TABLE "jobseeker_profiles" ADD COLUMN "birth_year" integer;--> statement-breakpoint
-- Existing profiles keep their age: the year from the stored YYYY-MM-DD date
-- of birth (the next migration then drops the full date).
UPDATE "jobseeker_profiles" SET "birth_year" = substring("date_of_birth" from 1 for 4)::integer WHERE "date_of_birth" ~ '^\d{4}-\d{2}-\d{2}$';