ALTER TYPE "public"."team_activity_action" ADD VALUE 'job_assigned';--> statement-breakpoint
ALTER TYPE "public"."team_activity_action" ADD VALUE 'job_unassigned';--> statement-breakpoint
ALTER TYPE "public"."team_member_role" ADD VALUE 'hiring_manager';--> statement-breakpoint
ALTER TYPE "public"."team_member_role" ADD VALUE 'panel';--> statement-breakpoint
CREATE TABLE "job_posting_hiring_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"team_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_posting_hiring_managers_posting_member_unique" UNIQUE("job_posting_id","team_member_id")
);
--> statement-breakpoint
ALTER TABLE "employer_team_activity" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "job_posting_hiring_managers" ADD CONSTRAINT "job_posting_hiring_managers_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posting_hiring_managers" ADD CONSTRAINT "job_posting_hiring_managers_team_member_id_employer_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."employer_team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_posting_hiring_managers_team_member_id_idx" ON "job_posting_hiring_managers" USING btree ("team_member_id");