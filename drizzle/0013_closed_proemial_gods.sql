ALTER TABLE "employer_profiles" ALTER COLUMN "recent_news" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "avatar_url" text;