CREATE TYPE "public"."ai_interview_status" AS ENUM('invited', 'in_progress', 'processing', 'completed', 'failed', 'expired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."ai_usage_feature" ADD VALUE 'ai_interview_questions';--> statement-breakpoint
ALTER TYPE "public"."ai_usage_feature" ADD VALUE 'ai_interview_transcription';--> statement-breakpoint
ALTER TYPE "public"."ai_usage_feature" ADD VALUE 'ai_interview_scoring';--> statement-breakpoint
CREATE TABLE "ai_interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_interview_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question" text NOT NULL,
	"key_points" text[] DEFAULT '{}' NOT NULL,
	"media_file_name" text,
	"media_kind" text,
	"duration_seconds" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"answered_at" timestamp with time zone,
	"transcript" text,
	"score" integer,
	"evaluation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_interview_questions_position_unique" UNIQUE("ai_interview_id","position")
);
--> statement-breakpoint
CREATE TABLE "ai_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"status" "ai_interview_status" DEFAULT 'invited' NOT NULL,
	"answer_seconds" integer DEFAULT 30 NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"invite_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consent_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"report" jsonb,
	"failure_reason" text,
	"recordings_expire_at" timestamp with time zone,
	"recordings_deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_interviews_job_application_id_unique" UNIQUE("job_application_id")
);
--> statement-breakpoint
ALTER TABLE "ai_interview_questions" ADD CONSTRAINT "ai_interview_questions_ai_interview_id_ai_interviews_id_fk" FOREIGN KEY ("ai_interview_id") REFERENCES "public"."ai_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD CONSTRAINT "ai_interviews_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD CONSTRAINT "ai_interviews_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_interview_questions_interview_idx" ON "ai_interview_questions" USING btree ("ai_interview_id");--> statement-breakpoint
CREATE INDEX "ai_interviews_status_idx" ON "ai_interviews" USING btree ("status");