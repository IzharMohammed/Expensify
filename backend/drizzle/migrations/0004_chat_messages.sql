CREATE TYPE "chat_role" AS ENUM ('user', 'assistant');

CREATE TABLE "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" "chat_role" NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

CREATE INDEX "chat_messages_user_conversation_idx"
ON "chat_messages" ("user_id", "conversation_id", "created_at");

CREATE INDEX "chat_messages_user_created_idx"
ON "chat_messages" ("user_id", "created_at");
