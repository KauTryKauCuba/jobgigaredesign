ALTER TABLE "job_postings" ALTER COLUMN "benefits" SET DATA TYPE text[] USING (CASE WHEN "benefits" IS NULL OR btrim("benefits") = '' THEN '{}'::text[] ELSE string_to_array("benefits", E'\n') END);--> statement-breakpoint
ALTER TABLE "job_postings" ALTER COLUMN "benefits" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "job_postings" ALTER COLUMN "benefits" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "start_availability" text;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "working_hours" text;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "contact_user_id" uuid;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_contact_user_id_users_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;