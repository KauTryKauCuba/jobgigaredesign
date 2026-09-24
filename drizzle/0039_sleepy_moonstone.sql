CREATE TYPE "public"."application_rejection_reason" AS ENUM('skills_mismatch', 'experience_mismatch', 'qualification_mismatch', 'location_mismatch', 'salary_mismatch', 'position_filled', 'failed_interview', 'other');--> statement-breakpoint
CREATE TYPE "public"."jobseeker_visibility" AS ENUM('discoverable', 'private', 'hidden_from_companies');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'expired_grace', 'withdrawn');--> statement-breakpoint
CREATE TABLE "interview_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"round_name" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"capacity" integer DEFAULT 1 NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"proposed_to" uuid[] DEFAULT '{}' NOT NULL,
	"response_deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "offer_status" DEFAULT 'pending' NOT NULL,
	"terms" jsonb NOT NULL,
	"expiry_date" timestamp with time zone NOT NULL,
	"grace_window_end" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_term" text NOT NULL,
	"esco_uri" text NOT NULL,
	"language" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_pool_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"jobseeker_profile_id" uuid NOT NULL,
	"consent_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expiry_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "talent_pool_entries_employer_jobseeker_unique" UNIQUE("employer_profile_id","jobseeker_profile_id")
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "rejection_reason_code" "application_rejection_reason";--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "terms_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "nice_to_have_skills" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "benefits" text;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "openings_total" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "offers_outstanding" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "hires_confirmed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "over_offer_multiplier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "masco_code" text;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "accepts_new_applications" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "expiry_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "target_masco_codes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "talent_pool_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "visibility" "jobseeker_visibility" DEFAULT 'discoverable' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pool_entries" ADD CONSTRAINT "talent_pool_entries_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pool_entries" ADD CONSTRAINT "talent_pool_entries_jobseeker_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("jobseeker_profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;