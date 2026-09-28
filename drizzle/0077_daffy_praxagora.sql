CREATE TYPE "public"."employer_badge_key" AS ENUM('profile_completed', 'logo_added', 'profile_boosted', 'first_job_posted', 'screening_enabled', 'first_candidate_screened', 'first_hire', 'team_builder');--> statement-breakpoint
CREATE TABLE "employer_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"badge_key" "employer_badge_key" NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employer_badges_profile_key_unique" UNIQUE("employer_profile_id","badge_key")
);
--> statement-breakpoint
ALTER TABLE "employer_badges" ADD CONSTRAINT "employer_badges_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employer_badges_employer_profile_id_idx" ON "employer_badges" USING btree ("employer_profile_id");