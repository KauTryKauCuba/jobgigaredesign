ALTER TABLE "job_postings" ADD COLUMN "salary_period" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "show_salary" boolean DEFAULT true NOT NULL;