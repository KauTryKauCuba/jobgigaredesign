ALTER TABLE "job_postings" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_slug_unique" UNIQUE("slug");