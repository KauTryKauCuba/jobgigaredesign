ALTER TABLE "employer_profiles" ADD COLUMN "address_line1" text NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "city" text NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "state" text NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "postcode" text NOT NULL;