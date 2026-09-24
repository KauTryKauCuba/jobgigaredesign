CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'internship');--> statement-breakpoint
CREATE TYPE "public"."job_posting_status" AS ENUM('draft', 'pending', 'active', 'filled', 'closed', 'rejected', 'flagged');--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"posting_name" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"responsibilities" text NOT NULL,
	"industry" text,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"work_arrangement" "work_arrangement" DEFAULT 'onsite' NOT NULL,
	"location" text NOT NULL,
	"salary_min" integer,
	"salary_max" integer,
	"openings" integer DEFAULT 1 NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"soft_skills" text[] DEFAULT '{}' NOT NULL,
	"min_years_experience" integer,
	"min_qualification_tier" text,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"work_authorizations" "work_authorization"[] DEFAULT '{}' NOT NULL,
	"driving_license" "driving_license",
	"status" "job_posting_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"flag_reason" text,
	"flagged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;