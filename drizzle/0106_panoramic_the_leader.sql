ALTER TABLE "employer_profiles" ADD COLUMN "gallery_photos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "facilities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "dress_code" text;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "awards" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "leaders" jsonb DEFAULT '[]'::jsonb NOT NULL;