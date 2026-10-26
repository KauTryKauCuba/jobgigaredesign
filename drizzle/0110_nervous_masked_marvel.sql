CREATE TABLE "phone_verification_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verified_phones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verified_phones_user_phone_unique" UNIQUE("user_id","phone")
);
--> statement-breakpoint
ALTER TABLE "phone_verification_attempts" ADD CONSTRAINT "phone_verification_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_phones" ADD CONSTRAINT "verified_phones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_verification_attempts_user_idx" ON "phone_verification_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "phone_verification_attempts_phone_idx" ON "phone_verification_attempts" USING btree ("phone","created_at");