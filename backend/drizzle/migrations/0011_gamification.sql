CREATE TABLE "streaks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_qualifying_date" date
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	CONSTRAINT "badges_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_badges_user_badge_unique" ON "user_badges" USING btree ("user_id","badge_id");
--> statement-breakpoint
CREATE INDEX "user_badges_user_earned_idx" ON "user_badges" USING btree ("user_id","earned_at");
--> statement-breakpoint
INSERT INTO "badges" ("code", "name", "description", "icon") VALUES
  ('first_expense', 'First Step', 'Log your first expense.', 'ReceiptText'),
  ('no_swiggy_week', 'Home Table', 'Complete an active week without spending at Swiggy.', 'CookingPot'),
  ('saved_10k', 'Five Figures Ahead', 'Keep at least Rs. 10,000 of this month''s income unspent.', 'PiggyBank'),
  ('streak_7', 'Steady Week', 'Maintain a 7-day qualifying streak.', 'Flame'),
  ('streak_30', 'Monthly Mastery', 'Maintain a 30-day qualifying streak.', 'Trophy')
ON CONFLICT ("code") DO NOTHING;
