CREATE TYPE "public"."ssm_verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "ssm_document_url" text;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "ssm_verification_status" "ssm_verification_status" DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "ssm_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "ssm_rejection_reason" text;