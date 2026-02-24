-- Extend audit_logs for cross-cutting platform layer (logging/audit/error handling).
ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
ADD COLUMN IF NOT EXISTS "actorRole" TEXT,
ADD COLUMN IF NOT EXISTS "changes" JSONB,
ADD COLUMN IF NOT EXISTS "ip" TEXT,
ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
ADD COLUMN IF NOT EXISTS "requestId" TEXT;

-- Preserve old actorId data in the new actorUserId column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'actorId'
  ) THEN
    UPDATE "audit_logs"
    SET "actorUserId" = COALESCE("actorUserId", "actorId")
    WHERE "actorId" IS NOT NULL;
  END IF;
END $$;

-- Keep audit timestamp aligned with historical records.
UPDATE "audit_logs"
SET "timestamp" = "createdAt";

-- Backfill combined changes payload from legacy columns.
UPDATE "audit_logs"
SET "changes" = COALESCE(
  "changes",
  jsonb_build_object(
    'oldValue',
    "oldValue",
    'newValue',
    "newValue",
    'metadata',
    "metadata"
  )
);

DROP INDEX IF EXISTS "audit_logs_actorId_idx";
CREATE INDEX IF NOT EXISTS "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp");
