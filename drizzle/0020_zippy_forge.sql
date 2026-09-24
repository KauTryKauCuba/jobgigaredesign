CREATE TYPE "public"."driving_license" AS ENUM('none', 'b2', 'b', 'd', 'da', 'e');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'divorced', 'widowed', 'prefer_not_to_say');--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "date_of_birth" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "marital_status" "marital_status";--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "jobseeker_profiles" ADD COLUMN "driving_license" "driving_license";