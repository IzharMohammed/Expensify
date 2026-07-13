CREATE TABLE IF NOT EXISTS "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "tags_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "expense_tags" (
  "expense_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  CONSTRAINT "expense_tags_expense_id_expenses_id_fk"
    FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE,
  CONSTRAINT "expense_tags_tag_id_tags_id_fk"
    FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "tags_user_id_idx" ON "tags" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_user_lower_name_unique"
  ON "tags" ("user_id", lower("name"));
CREATE UNIQUE INDEX IF NOT EXISTS "expense_tags_expense_tag_unique"
  ON "expense_tags" ("expense_id", "tag_id");
CREATE INDEX IF NOT EXISTS "expense_tags_tag_id_idx" ON "expense_tags" ("tag_id");

-- These indexes keep the AND-combined search responsive without requiring an extension.
CREATE INDEX IF NOT EXISTS "expenses_user_amount_idx" ON "expenses" ("user_id", "amount");
CREATE INDEX IF NOT EXISTS "expenses_user_payment_method_idx"
  ON "expenses" ("user_id", "payment_method");
