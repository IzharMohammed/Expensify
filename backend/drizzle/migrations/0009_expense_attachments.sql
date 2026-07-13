DO $$ BEGIN
  CREATE TYPE "attachment_file_type" AS ENUM ('image', 'pdf');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "attachment_label" AS ENUM ('receipt', 'invoice', 'warranty', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "expense_id" uuid NOT NULL,
  "file_url" text NOT NULL,
  "file_type" "attachment_file_type" NOT NULL,
  "label" "attachment_label" NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "attachments_expense_id_expenses_id_fk"
    FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "attachments_expense_uploaded_idx"
  ON "attachments" ("expense_id", "uploaded_at");

COMMENT ON COLUMN "attachments"."file_url" IS
  'Private s3:// object URI. Public access is provided only through short-lived signed URLs.';
