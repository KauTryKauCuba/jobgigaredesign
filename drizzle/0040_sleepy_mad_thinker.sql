ALTER TABLE "employer_profiles" ALTER COLUMN "smart_match_criteria" SET DEFAULT '{"skills":true,"niceToHaveSkills":true,"experience":true,"workAuthorization":true,"drivingLicense":true}'::jsonb;--> statement-breakpoint
UPDATE "employer_profiles"
SET "smart_match_criteria" = jsonb_set("smart_match_criteria", '{niceToHaveSkills}', 'true', true)
WHERE NOT ("smart_match_criteria" ? 'niceToHaveSkills');