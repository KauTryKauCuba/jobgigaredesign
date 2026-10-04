ALTER TABLE "interview_evaluations" DROP CONSTRAINT "interview_evaluations_job_application_id_unique";--> statement-breakpoint
ALTER TABLE "interview_evaluations" ADD COLUMN "evaluator_user_id" uuid;--> statement-breakpoint
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_evaluator_user_id_users_id_fk" FOREIGN KEY ("evaluator_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_evaluations_job_application_id_idx" ON "interview_evaluations" USING btree ("job_application_id");--> statement-breakpoint
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_application_evaluator_unique" UNIQUE("job_application_id","evaluator_user_id");