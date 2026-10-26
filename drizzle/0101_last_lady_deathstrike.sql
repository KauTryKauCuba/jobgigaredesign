ALTER TABLE "company_ads" DROP CONSTRAINT "company_ads_employer_profile_id_unique";--> statement-breakpoint
ALTER TABLE "company_ads" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "company_ads" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "company_ads" ADD COLUMN "live_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_ads" ADD COLUMN "ending_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_ads" ADD COLUMN "ended_notified_at" timestamp with time zone;--> statement-breakpoint
-- Ads created before booking existed: a 30-day run from when they were
-- approved (or submitted), already "live"-notified so nobody gets a surprise message.
UPDATE "company_ads" SET
  "start_date" = (COALESCE("reviewed_at", "submitted_at") AT TIME ZONE 'Asia/Kuala_Lumpur')::date,
  "end_date" = (COALESCE("reviewed_at", "submitted_at") AT TIME ZONE 'Asia/Kuala_Lumpur')::date + 30,
  "live_notified_at" = CASE WHEN "status" = 'approved' THEN now() END;--> statement-breakpoint
ALTER TABLE "company_ads" ALTER COLUMN "start_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "company_ads" ALTER COLUMN "end_date" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "company_ads_employer_profile_id_idx" ON "company_ads" USING btree ("employer_profile_id");--> statement-breakpoint
CREATE INDEX "company_ads_dates_idx" ON "company_ads" USING btree ("start_date","end_date");
