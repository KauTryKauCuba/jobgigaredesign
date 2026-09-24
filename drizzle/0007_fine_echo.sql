ALTER TABLE "employer_profiles" ADD COLUMN "company_description" text;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "benefits_epf" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "benefits_socso" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "benefits_eis" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "benefits_extra" text;