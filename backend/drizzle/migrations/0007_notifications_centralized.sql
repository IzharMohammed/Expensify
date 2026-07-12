ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'budget_alert';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'no_spend_today';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'anomaly_alert';

ALTER TABLE "notifications"
RENAME COLUMN "read" TO "is_read";
