ALTER TYPE "public"."ai_usage_feature" ADD VALUE 'cover_letter';--> statement-breakpoint
CREATE TABLE "cover_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobseeker_profile_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"job_title" text NOT NULL,
	"job_posting_text" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_jobseeker_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("jobseeker_profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;