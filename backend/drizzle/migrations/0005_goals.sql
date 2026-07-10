CREATE TABLE "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "target_amount" numeric(12, 2) NOT NULL,
  "current_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "target_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "goals"
ADD CONSTRAINT "goals_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

CREATE INDEX "goals_user_created_idx" ON "goals" ("user_id", "created_at");

CREATE TABLE "goal_contributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "goal_id" uuid NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "date" timestamp with time zone NOT NULL,
  "note" text
);

ALTER TABLE "goal_contributions"
ADD CONSTRAINT "goal_contributions_goal_id_goals_id_fk"
FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id")
ON DELETE cascade ON UPDATE no action;

CREATE INDEX "goal_contributions_goal_date_idx" ON "goal_contributions" ("goal_id", "date");
