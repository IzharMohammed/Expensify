CREATE TYPE "insight_type" AS ENUM ('spending_pattern', 'comparison', 'suggestion', 'prediction');
CREATE TYPE "insight_priority" AS ENUM ('low', 'medium', 'high');

CREATE TABLE "insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "date" date NOT NULL,
  "month" date NOT NULL,
  "insight_text" text NOT NULL,
  "category" text,
  "type" "insight_type" NOT NULL,
  "priority" "insight_priority" DEFAULT 'medium' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "insights"
ADD CONSTRAINT "insights_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

CREATE INDEX "insights_user_date_idx" ON "insights" ("user_id", "date");
CREATE INDEX "insights_user_month_idx" ON "insights" ("user_id", "month");
