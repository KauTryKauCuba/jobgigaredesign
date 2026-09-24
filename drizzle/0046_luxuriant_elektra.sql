CREATE TYPE "public"."job_posting_report_reason" AS ENUM('spam', 'scam', 'discriminatory', 'misleading', 'inappropriate', 'other');--> statement-breakpoint
CREATE TABLE "job_posting_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"jobseeker_profile_id" uuid NOT NULL,
	"reason" "job_posting_report_reason" NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_posting_reports_posting_jobseeker_unique" UNIQUE("job_posting_id","jobseeker_profile_id")
);
--> statement-breakpoint
ALTER TABLE "job_posting_reports" ADD CONSTRAINT "job_posting_reports_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_reports" ADD CONSTRAINT "job_posting_reports_jobseeker_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("jobseeker_profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;