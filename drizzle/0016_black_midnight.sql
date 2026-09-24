CREATE TABLE "employer_onboarding_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employer_onboarding_drafts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "employer_onboarding_drafts" ADD CONSTRAINT "employer_onboarding_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;