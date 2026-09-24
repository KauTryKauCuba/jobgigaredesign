CREATE TYPE "public"."team_member_role" AS ENUM('owner', 'admin');--> statement-breakpoint
CREATE TYPE "public"."team_member_status" AS ENUM('active', 'pending');--> statement-breakpoint
CREATE TABLE "employer_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"role" "team_member_role" DEFAULT 'admin' NOT NULL,
	"status" "team_member_status" DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	CONSTRAINT "employer_team_members_employer_profile_id_email_unique" UNIQUE("employer_profile_id","email")
);
--> statement-breakpoint
ALTER TABLE "employer_team_members" ADD CONSTRAINT "employer_team_members_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_team_members" ADD CONSTRAINT "employer_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;