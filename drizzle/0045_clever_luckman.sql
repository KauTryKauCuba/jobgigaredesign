CREATE TABLE "jobseeker_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"job_title" text,
	"company" text,
	"phone" text,
	"email" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobseeker_references" ADD CONSTRAINT "jobseeker_references_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;