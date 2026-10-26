ALTER TABLE "phone_verification_attempts" ADD COLUMN "ip" text;--> statement-breakpoint
CREATE INDEX "phone_verification_attempts_ip_idx" ON "phone_verification_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "phone_verification_attempts_created_idx" ON "phone_verification_attempts" USING btree ("created_at");