CREATE TABLE "appointments" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"place" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"all_day" boolean NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "care_days" (
	"household_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"at_home" boolean NOT NULL,
	"bring" text,
	"pick" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_days_household_id_weekday_pk" PRIMARY KEY("household_id","weekday")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"budget_cents" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"contains" text NOT NULL,
	"category_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_rules_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"interval_days" integer NOT NULL,
	"rotation" text[] NOT NULL,
	"next_due" date NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chores_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "clothing_sizes" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"label" text NOT NULL,
	"size" text NOT NULL,
	"note" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clothing_sizes_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "doses" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"medicine_id" text NOT NULL,
	"amount" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"given_by" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doses_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "food_tries" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"verdict" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_tries_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "growth_entries" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"date" date NOT NULL,
	"weight_grams" integer NOT NULL,
	"length_cm" double precision NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_entries_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"bought" boolean NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "meal_plan" (
	"household_id" uuid NOT NULL,
	"date" date NOT NULL,
	"recipe_id" text NOT NULL,
	"cook_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plan_household_id_date_pk" PRIMARY KEY("household_id","date")
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"interval_hours" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medicines_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_household_id_id_pk" PRIMARY KEY("household_id","id"),
	CONSTRAINT "members_email_unique" UNIQUE("email"),
	CONSTRAINT "members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"date" date NOT NULL,
	"text" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"room" text NOT NULL,
	"kind" text NOT NULL,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"cost_cents" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"ingredients" text[] NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "routine_items" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"time" text NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_items_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"checked" boolean NOT NULL,
	"source" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_items_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"label" text NOT NULL,
	"icon" text NOT NULL,
	"opened_by" text,
	"opened_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "stock_items" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_items_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"assignee_id" text NOT NULL,
	"due" date,
	"due_label" text,
	"done_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "temperatures" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"celsius" double precision NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "temperatures_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"household_id" uuid NOT NULL,
	"id" text NOT NULL,
	"date" date NOT NULL,
	"counterparty" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"category_id" text,
	"source" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_household_id_id_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_days" ADD CONSTRAINT "care_days_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_household_id_category_id_categories_household_id_id_fk" FOREIGN KEY ("household_id","category_id") REFERENCES "public"."categories"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clothing_sizes" ADD CONSTRAINT "clothing_sizes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doses" ADD CONSTRAINT "doses_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doses" ADD CONSTRAINT "doses_household_id_medicine_id_medicines_household_id_id_fk" FOREIGN KEY ("household_id","medicine_id") REFERENCES "public"."medicines"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doses" ADD CONSTRAINT "doses_household_id_given_by_members_household_id_id_fk" FOREIGN KEY ("household_id","given_by") REFERENCES "public"."members"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_tries" ADD CONSTRAINT "food_tries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_entries" ADD CONSTRAINT "growth_entries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_household_id_project_id_projects_household_id_id_fk" FOREIGN KEY ("household_id","project_id") REFERENCES "public"."projects"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_household_id_recipe_id_recipes_household_id_id_fk" FOREIGN KEY ("household_id","recipe_id") REFERENCES "public"."recipes"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_household_id_cook_id_members_household_id_id_fk" FOREIGN KEY ("household_id","cook_id") REFERENCES "public"."members"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_household_id_member_id_members_household_id_id_fk" FOREIGN KEY ("household_id","member_id") REFERENCES "public"."members"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_items" ADD CONSTRAINT "routine_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_household_id_opened_by_members_household_id_id_fk" FOREIGN KEY ("household_id","opened_by") REFERENCES "public"."members"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_household_id_assignee_id_members_household_id_id_fk" FOREIGN KEY ("household_id","assignee_id") REFERENCES "public"."members"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temperatures" ADD CONSTRAINT "temperatures_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_id_category_id_categories_household_id_id_fk" FOREIGN KEY ("household_id","category_id") REFERENCES "public"."categories"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscriptions_household_member_idx" ON "push_subscriptions" USING btree ("household_id","member_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");