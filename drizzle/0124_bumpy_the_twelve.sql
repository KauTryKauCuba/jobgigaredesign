ALTER TYPE "public"."ai_usage_feature" ADD VALUE 'resume_review';--> statement-breakpoint
CREATE TABLE "resume_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobseeker_profile_id" uuid NOT NULL,
	"resume_url" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume_reviews" ADD CONSTRAINT "resume_reviews_jobseeker_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("jobseeker_profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_reviews_profile_created_idx" ON "resume_reviews" USING btree ("jobseeker_profile_id","created_at");