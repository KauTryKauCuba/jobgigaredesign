CREATE TABLE "jobseeker_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"location" text NOT NULL,
	"target_role" text NOT NULL,
	"years_experience" integer NOT NULL,
	"skills" text[] NOT NULL,
	"employment_type" text NOT NULL,
	"expected_salary_min" integer NOT NULL,
	"expected_salary_max" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobseeker_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD CONSTRAINT "jobseeker_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;