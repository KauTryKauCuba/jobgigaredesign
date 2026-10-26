CREATE TYPE "public"."site_theme_audience" AS ENUM('employer', 'jobseeker');--> statement-breakpoint
CREATE TABLE "site_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience" "site_theme_audience" NOT NULL,
	"name" text NOT NULL,
	"preset_key" text,
	"colors" jsonb NOT NULL,
	"banner" jsonb NOT NULL,
	"effect" text DEFAULT 'none' NOT NULL,
	"effect_scope" text DEFAULT 'landing' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_themes" ADD CONSTRAINT "site_themes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_themes_one_active_per_audience" ON "site_themes" USING btree ("audience") WHERE "site_themes"."is_active";