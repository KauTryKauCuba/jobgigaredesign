UPDATE "employer_profiles" SET "contact_position" = "contact_role" WHERE "contact_position" IS NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ALTER COLUMN "contact_position" SET NOT NULL;
