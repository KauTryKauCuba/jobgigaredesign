ALTER TYPE "public"."employment_type" ADD VALUE 'freelance';--> statement-breakpoint
ALTER TYPE "public"."employment_type" ADD VALUE 'temporary';--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "office_days_per_week" integer;