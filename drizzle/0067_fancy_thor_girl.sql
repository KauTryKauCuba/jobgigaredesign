ALTER TABLE "job_postings" ADD COLUMN "ask_min_years_experience" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "ask_min_qualification_tier" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "ask_driving_license" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "ask_languages" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "ask_work_authorizations" boolean DEFAULT true NOT NULL;