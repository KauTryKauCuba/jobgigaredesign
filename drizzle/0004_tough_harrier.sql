CREATE TYPE "public"."language_level" AS ENUM('basic', 'conversational', 'fluent', 'native');--> statement-breakpoint
CREATE TYPE "public"."notice_period" AS ENUM('immediate', 'one_week', 'two_weeks', 'one_month', 'two_months', 'more_than_two_months');--> statement-breakpoint
CREATE TYPE "public"."work_arrangement" AS ENUM('remote', 'hybrid', 'onsite');--> statement-breakpoint
CREATE TYPE "public"."work_authorization" AS ENUM('citizen', 'permanent_resident', 'work_pass_holder', 'needs_sponsorship');--> statement-breakpoint
CREATE TABLE "jobseeker_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"year" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobseeker_education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"institution" text NOT NULL,
	"field_of_study" text,
	"qualification_tier" text NOT NULL,
	"graduation_year" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobseeker_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"language" text NOT NULL,
	"spoken_level" "language_level" NOT NULL,
	"written_level" "language_level" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobseeker_work_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"achievements" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "target_occupation_code" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "portfolio_url" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "github_url" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "notice_period" "notice_period" NOT NULL;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "work_arrangement" "work_arrangement" NOT NULL;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "work_authorization" "work_authorization" NOT NULL;--> statement-breakpoint
ALTER TABLE "jobseeker_certifications" ADD CONSTRAINT "jobseeker_certifications_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobseeker_education" ADD CONSTRAINT "jobseeker_education_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobseeker_languages" ADD CONSTRAINT "jobseeker_languages_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobseeker_work_experiences" ADD CONSTRAINT "jobseeker_work_experiences_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;