CREATE TYPE "public"."household_role" AS ENUM('owner', 'member');
--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'settled');
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "household_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
CREATE TABLE "expense_splits" (
	"expense_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "households_owner_id_idx" ON "households" USING btree ("owner_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "household_members_household_user_unique" ON "household_members" USING btree ("household_id","user_id");
--> statement-breakpoint
CREATE INDEX "household_members_user_id_idx" ON "household_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "expenses_household_id_idx" ON "expenses" USING btree ("household_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "expense_splits_expense_user_unique" ON "expense_splits" USING btree ("expense_id","user_id");
--> statement-breakpoint
CREATE INDEX "expense_splits_user_id_idx" ON "expense_splits" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "settlements_household_status_idx" ON "settlements" USING btree ("household_id","status");
