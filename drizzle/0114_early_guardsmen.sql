CREATE TYPE "public"."campaign_claim_status" AS ENUM('pending', 'approved', 'rejected', 'entered', 'selected', 'won', 'not_selected');--> statement-breakpoint
CREATE TYPE "public"."campaign_reward_type" AS ENUM('voucher', 'draw');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'live', 'paused', 'ended');--> statement-breakpoint
CREATE TABLE "campaign_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"audience" "role" NOT NULL,
	"user_id" uuid,
	"phone" text NOT NULL,
	"user_email" text NOT NULL,
	"user_name" text,
	"status" "campaign_claim_status" NOT NULL,
	"code_id" uuid,
	"reject_reason" text,
	"reviewed_by_email" text,
	"reviewed_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_claims_campaign_user_unique" UNIQUE("campaign_id","user_id"),
	CONSTRAINT "campaign_claims_campaign_phone_unique" UNIQUE("campaign_id","phone")
);
--> statement-breakpoint
CREATE TABLE "campaign_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"audience" "role" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"type" "campaign_reward_type" DEFAULT 'voucher' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"value_rm" double precision,
	"winner_count" integer DEFAULT 1 NOT NULL,
	"drawn_at" timestamp with time zone,
	"announced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_rewards_campaign_audience_unique" UNIQUE("campaign_id","audience")
);
--> statement-breakpoint
CREATE TABLE "campaign_voucher_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reward_id" uuid NOT NULL,
	"code" text NOT NULL,
	"expires_on" date,
	"claim_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_voucher_codes_claim_id_unique" UNIQUE("claim_id"),
	CONSTRAINT "campaign_voucher_codes_reward_code_unique" UNIQUE("reward_id","code")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"trigger" text DEFAULT 'phone_verified' NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"needs_approval" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"terms" text DEFAULT '' NOT NULL,
	"created_by_user_id" uuid,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_reward_id_campaign_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."campaign_rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_code_id_campaign_voucher_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."campaign_voucher_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_voucher_codes" ADD CONSTRAINT "campaign_voucher_codes_reward_id_campaign_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."campaign_rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_claims_reward_status_idx" ON "campaign_claims" USING btree ("reward_id","status");--> statement-breakpoint
CREATE INDEX "campaign_claims_user_idx" ON "campaign_claims" USING btree ("user_id","audience");--> statement-breakpoint
CREATE INDEX "campaign_voucher_codes_reward_claim_idx" ON "campaign_voucher_codes" USING btree ("reward_id","claim_id");