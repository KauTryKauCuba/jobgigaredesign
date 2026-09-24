CREATE TYPE "public"."interview_recommendation" AS ENUM('strong_hire', 'hire', 'no_hire', 'strong_no_hire');--> statement-breakpoint
CREATE TABLE "interview_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"scores" jsonb NOT NULL,
	"recommendation" "interview_recommendation" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_evaluations_job_application_id_unique" UNIQUE("job_application_id")
);
--> statement-breakpoint
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;