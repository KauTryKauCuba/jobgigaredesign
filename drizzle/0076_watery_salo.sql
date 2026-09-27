CREATE INDEX "employer_addresses_employer_profile_id_idx" ON "employer_addresses" USING btree ("employer_profile_id");--> statement-breakpoint
CREATE INDEX "employer_team_activity_employer_profile_id_idx" ON "employer_team_activity" USING btree ("employer_profile_id");--> statement-breakpoint
CREATE INDEX "employer_team_members_user_id_idx" ON "employer_team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_applications_jobseeker_profile_id_idx" ON "job_applications" USING btree ("jobseeker_profile_id");--> statement-breakpoint
CREATE INDEX "job_postings_employer_profile_id_idx" ON "job_postings" USING btree ("employer_profile_id");