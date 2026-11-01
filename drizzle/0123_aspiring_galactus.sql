CREATE TABLE "superadmin_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"added_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "superadmin_members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "superadmin_members" ADD CONSTRAINT "superadmin_members_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;