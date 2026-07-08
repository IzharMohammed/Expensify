CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "auth_provider" AS ENUM ('local', 'google');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "password_hash" text,
  "name" text NOT NULL,
  "avatar_url" text,
  "auth_provider" "auth_provider" DEFAULT 'local' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE cascade ON UPDATE no action;

CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" ("user_id");
CREATE INDEX "refresh_tokens_revoked_idx" ON "refresh_tokens" ("revoked");
