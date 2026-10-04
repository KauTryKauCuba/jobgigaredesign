CREATE TABLE "job_application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"from_status" "application_status",
	"to_status" "application_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_application_events" ADD CONSTRAINT "job_application_events_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_application_events_job_application_id_idx" ON "job_application_events" USING btree ("job_application_id");--> statement-breakpoint
-- Backfill (hand-written): applications predate the event log, so give each
-- one its "applied" event, plus a single step to its current stage at
-- updated_at — the best available estimate of when it got there.
INSERT INTO "job_application_events" ("job_application_id", "from_status", "to_status", "created_at")
SELECT "id", NULL, 'applied', "applied_at" FROM "job_applications";--> statement-breakpoint
INSERT INTO "job_application_events" ("job_application_id", "from_status", "to_status", "created_at")
SELECT "id", 'applied', "status", GREATEST("updated_at", "applied_at")
FROM "job_applications"
WHERE "status" <> 'applied';