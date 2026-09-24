ALTER TABLE "employer_profiles" ADD COLUMN "benefits" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "benefits_epf";--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "benefits_socso";--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "benefits_eis";--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "benefits_extra";
