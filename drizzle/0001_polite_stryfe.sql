ALTER TABLE "meal_plan" ALTER COLUMN "recipe_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD COLUMN "title" text;--> statement-breakpoint
UPDATE "meal_plan" AS m SET "title" = r."name" FROM "recipes" AS r WHERE r."household_id" = m."household_id" AND r."id" = m."recipe_id";--> statement-breakpoint
ALTER TABLE "meal_plan" ALTER COLUMN "title" SET NOT NULL;
