CREATE TABLE "job_ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"media_type" "company_ad_media_type" NOT NULL,
	"file_name" text NOT NULL,
	"status" "company_ad_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"live_notified_at" timestamp with time zone,
	"ending_notified_at" timestamp with time zone,
	"ended_notified_at" timestamp with time zone,
	"submitted_by_user_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_ads" ADD CONSTRAINT "job_ads_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_ads" ADD CONSTRAINT "job_ads_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_ads" ADD CONSTRAINT "job_ads_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_ads_employer_profile_id_idx" ON "job_ads" USING btree ("employer_profile_id");--> statement-breakpoint
CREATE INDEX "job_ads_job_posting_id_idx" ON "job_ads" USING btree ("job_posting_id");--> statement-breakpoint
CREATE INDEX "job_ads_dates_idx" ON "job_ads" USING btree ("start_date","end_date");