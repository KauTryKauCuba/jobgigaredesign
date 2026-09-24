ALTER TABLE "employer_profiles" ADD COLUMN "recent_news_v2" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "recent_news";--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "recent_news_source_url";--> statement-breakpoint
ALTER TABLE "employer_profiles" RENAME COLUMN "recent_news_v2" TO "recent_news";
