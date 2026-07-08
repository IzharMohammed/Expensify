CREATE TYPE "payment_method" AS ENUM ('upi', 'card', 'cash', 'netbanking');
CREATE TYPE "expense_source" AS ENUM ('text', 'voice', 'ocr', 'manual');

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "name" text NOT NULL,
  "icon" text NOT NULL,
  "color" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL
);

CREATE TABLE "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "merchant" text NOT NULL,
  "category_id" uuid,
  "payment_method" "payment_method",
  "date" timestamp with time zone NOT NULL,
  "note" text,
  "source" "expense_source" DEFAULT 'manual' NOT NULL,
  "raw_input" text,
  "receipt_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "categories"
ADD CONSTRAINT "categories_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_category_id_categories_id_fk"
FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id")
ON DELETE set null ON UPDATE no action;

CREATE INDEX "categories_user_id_idx" ON "categories" ("user_id");
CREATE INDEX "expenses_user_id_idx" ON "expenses" ("user_id");
CREATE INDEX "expenses_category_id_idx" ON "expenses" ("category_id");
CREATE INDEX "expenses_date_idx" ON "expenses" ("date");

INSERT INTO "categories" ("name", "icon", "color", "is_default") VALUES
  ('Food', 'UtensilsCrossed', '#F97316', true),
  ('Rent', 'Home', '#0F766E', true),
  ('Shopping', 'ShoppingBag', '#7C3AED', true),
  ('Petrol', 'Fuel', '#DC2626', true),
  ('EMI', 'ReceiptIndianRupee', '#2563EB', true),
  ('Investment', 'TrendingUp', '#15803D', true),
  ('Entertainment', 'Film', '#DB2777', true),
  ('Grocery', 'ShoppingCart', '#65A30D', true),
  ('Medical', 'Cross', '#0891B2', true),
  ('Travel', 'Plane', '#D97706', true),
  ('Education', 'GraduationCap', '#4F46E5', true);
