CREATE TABLE "light_auth_states" (
	"state" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "light_connections" (
	"household_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"credentials_enc" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"access_expires_at" timestamp with time zone,
	"refresh_lease_until" timestamp with time zone,
	"expiry_warned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "light_connections_household_id_provider_pk" PRIMARY KEY("household_id","provider")
);
--> statement-breakpoint
CREATE TABLE "light_devices" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"device_id" text NOT NULL,
	"channel" integer DEFAULT 0 NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"room" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "light_devices_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
ALTER TABLE "light_auth_states" ADD CONSTRAINT "light_auth_states_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "light_connections" ADD CONSTRAINT "light_connections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "light_devices" ADD CONSTRAINT "light_devices_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;