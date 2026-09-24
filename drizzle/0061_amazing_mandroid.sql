ALTER TABLE "job_postings" ADD COLUMN "poster_url" text;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "poster_generating_since" timestamp with time zone;