-- Add missing metadata columns for civil_servant_ranks.
-- Idempotent for environments where columns already exist.
ALTER TABLE "civil_servant_ranks"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "legalReference" TEXT,
  ADD COLUMN IF NOT EXISTS "replacedByCode" TEXT;
