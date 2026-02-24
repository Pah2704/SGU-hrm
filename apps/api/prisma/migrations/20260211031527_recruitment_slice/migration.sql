-- Legacy migration guard:
-- This migration may run before baseline in some environments.
-- Only drop actorId when both table and column exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'actorId'
  ) THEN
    ALTER TABLE "audit_logs" DROP COLUMN "actorId";
  END IF;
END $$;
