ALTER TYPE "public"."team_activity_action" ADD VALUE 'declined';--> statement-breakpoint
ALTER TYPE "public"."team_activity_action" ADD VALUE 'joined';--> statement-breakpoint
ALTER TABLE "employer_team_members" ADD COLUMN "invite_token_hash" text;--> statement-breakpoint
ALTER TABLE "employer_team_members" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employer_team_members" ADD COLUMN "invited_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "employer_team_members" ADD CONSTRAINT "employer_team_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_team_members" ADD CONSTRAINT "employer_team_members_invite_token_hash_unique" UNIQUE("invite_token_hash");