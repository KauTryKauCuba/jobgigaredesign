ALTER TABLE "employer_team_members" ADD COLUMN "profile_completed_at" timestamp with time zone;--> statement-breakpoint
-- Everyone already on a team when this shipped counts as done — only
-- teammates who join from now on get the "About you" welcome step.
UPDATE "employer_team_members" SET "profile_completed_at" = COALESCE("joined_at", now()) WHERE "status" = 'active';
