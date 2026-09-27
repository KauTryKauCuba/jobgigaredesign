-- Backfill any pre-existing row (created before this field was required) so
-- the NOT NULL below doesn't fail the migration on a live database.
UPDATE "jobseeker_profiles" SET "date_of_birth" = '2000-01-01' WHERE "date_of_birth" IS NULL;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ALTER COLUMN "date_of_birth" SET NOT NULL;