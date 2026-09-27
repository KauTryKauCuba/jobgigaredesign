ALTER TABLE "job_applications" ADD COLUMN "screening_answers" jsonb;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "screening_eligible" boolean;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "screening_enabled" boolean DEFAULT false NOT NULL;