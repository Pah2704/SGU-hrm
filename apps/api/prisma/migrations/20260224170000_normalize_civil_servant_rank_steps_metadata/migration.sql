-- Normalize constraint/index names and id default after salary scale table swap.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'civil_servant_rank_steps_new_pkey'
  ) THEN
    ALTER TABLE "civil_servant_rank_steps"
      RENAME CONSTRAINT "civil_servant_rank_steps_new_pkey"
      TO "civil_servant_rank_steps_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'civil_servant_rank_steps'
      AND column_name = 'id'
      AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE "civil_servant_rank_steps"
      ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'civil_servant_rank_steps_new_rankGroup_level_key'
  ) THEN
    ALTER INDEX "civil_servant_rank_steps_new_rankGroup_level_key"
      RENAME TO "civil_servant_rank_steps_rankGroup_level_key";
  END IF;
END $$;
