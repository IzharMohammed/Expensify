CREATE TYPE "recurring_frequency" AS ENUM ('monthly', 'weekly', 'yearly');
CREATE TYPE "notification_type" AS ENUM ('recurring_due');

CREATE TABLE "recurring_expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "merchant" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "category_id" uuid,
  "frequency" "recurring_frequency" NOT NULL,
  "next_due_date" timestamp with time zone NOT NULL,
  "is_auto_detected" boolean DEFAULT true NOT NULL,
  "is_confirmed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "recurring_expenses"
ADD CONSTRAINT "recurring_expenses_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

ALTER TABLE "recurring_expenses"
ADD CONSTRAINT "recurring_expenses_category_id_categories_id_fk"
FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id")
ON DELETE set null ON UPDATE no action;

CREATE INDEX "recurring_expenses_user_confirmed_idx"
ON "recurring_expenses" ("user_id", "is_confirmed", "next_due_date");

CREATE INDEX "recurring_expenses_category_idx"
ON "recurring_expenses" ("category_id");

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "recurring_expense_id" uuid,
  "type" "notification_type" NOT NULL,
  "message" text NOT NULL,
  "read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_recurring_expense_id_recurring_expenses_id_fk"
FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expenses"("id")
ON DELETE cascade ON UPDATE no action;

CREATE INDEX "notifications_user_created_idx"
ON "notifications" ("user_id", "created_at");
