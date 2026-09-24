CREATE TYPE "public"."team_activity_action" AS ENUM('invited', 'resent_invite', 'role_changed', 'removed');--> statement-breakpoint
CREATE TABLE "employer_team_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text NOT NULL,
	"action" "team_activity_action" NOT NULL,
	"target_email" text NOT NULL,
	"from_role" "team_member_role",
	"to_role" "team_member_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employer_team_activity" ADD CONSTRAINT "employer_team_activity_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_team_activity" ADD CONSTRAINT "employer_team_activity_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;