ALTER TABLE "job_posting_posters" DROP CONSTRAINT "job_posting_posters_job_posting_id_job_postings_id_fk";
--> statement-breakpoint
ALTER TABLE "job_posting_posters" ADD CONSTRAINT "job_posting_posters_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;