ALTER TYPE "public"."ai_usage_feature" ADD VALUE 'poster_generation';--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD COLUMN "actual_cost_usd" double precision;