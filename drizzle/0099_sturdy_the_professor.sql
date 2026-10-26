CREATE TYPE "public"."company_ad_media_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."company_ad_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "company_ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"media_type" "company_ad_media_type" NOT NULL,
	"file_name" text NOT NULL,
	"headline" text NOT NULL,
	"status" "company_ad_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"submitted_by_user_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_ads_employer_profile_id_unique" UNIQUE("employer_profile_id")
);
--> statement-breakpoint
ALTER TABLE "company_ads" ADD CONSTRAINT "company_ads_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_ads" ADD CONSTRAINT "company_ads_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;