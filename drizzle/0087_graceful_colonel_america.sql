CREATE TABLE "video_pitch_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_pitch_id" uuid NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"viewer_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_pitch_views_pitch_employer_unique" UNIQUE("video_pitch_id","employer_profile_id")
);
--> statement-breakpoint
CREATE TABLE "video_pitches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobseeker_profile_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"intro" text,
	"strengths" text[] DEFAULT '{}' NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_pitches_jobseeker_profile_id_unique" UNIQUE("jobseeker_profile_id")
);
--> statement-breakpoint
ALTER TABLE "video_pitch_views" ADD CONSTRAINT "video_pitch_views_video_pitch_id_video_pitches_id_fk" FOREIGN KEY ("video_pitch_id") REFERENCES "public"."video_pitches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pitch_views" ADD CONSTRAINT "video_pitch_views_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pitch_views" ADD CONSTRAINT "video_pitch_views_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pitches" ADD CONSTRAINT "video_pitches_jobseeker_profile_id_jobseeker_profiles_id_fk" FOREIGN KEY ("jobseeker_profile_id") REFERENCES "public"."jobseeker_profiles"("id") ON DELETE cascade ON UPDATE no action;