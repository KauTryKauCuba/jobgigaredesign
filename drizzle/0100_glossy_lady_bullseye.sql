ALTER TABLE "employer_profiles" DROP CONSTRAINT "employer_profiles_user_id_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_limit" integer;--> statement-breakpoint
CREATE INDEX "employer_profiles_user_id_idx" ON "employer_profiles" USING btree ("user_id");