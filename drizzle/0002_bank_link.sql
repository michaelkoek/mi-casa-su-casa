CREATE TABLE "bank_accounts" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"uid" text NOT NULL,
	"connection_id" text NOT NULL,
	"iban" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "bank_auth_states" (
	"state" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"aspsp_name" text NOT NULL,
	"aspsp_country" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"aspsp_name" text NOT NULL,
	"aspsp_country" text NOT NULL,
	"session_enc" text NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"expiry_warned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_connections_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "account_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transfer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "mcc" text;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_household_id_connection_id_bank_connections_household_id_id_fk" FOREIGN KEY ("household_id","connection_id") REFERENCES "public"."bank_connections"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_auth_states" ADD CONSTRAINT "bank_auth_states_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_household_date_idx" ON "transactions" USING btree ("household_id","date");