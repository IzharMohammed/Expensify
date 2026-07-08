CREATE TABLE "budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "month" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "monthly_income" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "month" timestamp with time zone NOT NULL
);

ALTER TABLE "budgets"
ADD CONSTRAINT "budgets_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

ALTER TABLE "budgets"
ADD CONSTRAINT "budgets_category_id_categories_id_fk"
FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id")
ON DELETE cascade ON UPDATE no action;

ALTER TABLE "monthly_income"
ADD CONSTRAINT "monthly_income_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

CREATE INDEX "budgets_user_month_idx" ON "budgets" ("user_id", "month");
CREATE UNIQUE INDEX "budgets_user_category_month_unique" ON "budgets" ("user_id", "category_id", "month");
CREATE UNIQUE INDEX "monthly_income_user_month_unique" ON "monthly_income" ("user_id", "month");
