CREATE TABLE "job_posting_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"jobseeker_profile_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_posting_views_posting_jobseeker_unique" UNIQUE("job_posting_id","jobseeker_profile_id")
);
--> statement-breakpoint
ALTER TABLE "job_posting_views" ADD CONSTRAINT "job_posting_views_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_views" ADD CONSTRAINT "job_posting_views_jobseeker_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("jobseeker_profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;