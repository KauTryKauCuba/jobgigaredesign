CREATE TABLE "job_posting_posters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"poster_url" text NOT NULL,
	"style" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "poster_pending_style" text;--> statement-breakpoint
ALTER TABLE "job_posting_posters" ADD CONSTRAINT "job_posting_posters_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "job_posting_posters" ("job_posting_id", "poster_url", "style", "created_at")
SELECT "id", "poster_url", 'playful', "updated_at" FROM "job_postings" WHERE "poster_url" IS NOT NULL;