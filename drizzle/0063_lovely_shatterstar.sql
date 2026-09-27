-- Added with a temporary default so this doesn't fail on a table with
-- existing rows; backfilled from the existing "City, State" `location`
-- string (best-effort) before the default is dropped again.
ALTER TABLE "jobseeker_profiles" ADD COLUMN "city" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "state" text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE "jobseeker_profiles" SET
  "city" = COALESCE(NULLIF(TRIM(SPLIT_PART("location", ',', 1)), ''), 'Unknown'),
  "state" = COALESCE(NULLIF(TRIM(SPLIT_PART("location", ',', 2)), ''), 'Unknown')
WHERE "city" = '' OR "state" = '';--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ALTER COLUMN "city" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ALTER COLUMN "state" DROP DEFAULT;