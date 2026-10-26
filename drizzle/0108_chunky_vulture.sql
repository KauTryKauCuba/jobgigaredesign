ALTER TABLE "job_applications" ADD COLUMN "screening_preferred_met" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "screening_preferred_total" integer;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "screening_preferred" text[] DEFAULT '{}' NOT NULL;