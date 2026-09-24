CREATE TABLE "employer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_profile_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postcode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employer_addresses" ADD CONSTRAINT "employer_addresses_employer_profile_id_employer_profiles_id_fk" FOREIGN KEY ("employer_profile_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "address_line1";--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "address_line2";--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "employer_profiles" DROP COLUMN "postcode";