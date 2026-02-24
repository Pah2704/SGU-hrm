-- Salary scale refactor v5
-- Guardrail order is mandatory:
-- 1) Enum swap + explicit rank mappings
-- 2) Build new rank-step table by rankGroup
-- 3) Remap salary_records.rankStepId
-- 4) Swap tables and restore FK

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Phase 1: Safe RankGroup enum swap
-- ---------------------------------------------------------------------------
CREATE TYPE "RankGroup_new" AS ENUM (
  'A0',
  'A1',
  'A2_1',
  'A2_2',
  'A3_1',
  'A3_2',
  'B'
);

ALTER TABLE "civil_servant_ranks"
  ALTER COLUMN "rankGroup" TYPE "RankGroup_new"
  USING CASE
    WHEN "rankGroup"::text = 'A2' THEN 'A2_1'::"RankGroup_new"
    WHEN "rankGroup"::text = 'A3' THEN 'A3_1'::"RankGroup_new"
    WHEN "rankGroup"::text = 'C' THEN 'B'::"RankGroup_new"
    ELSE "rankGroup"::text::"RankGroup_new"
  END;

DROP TYPE "RankGroup";
ALTER TYPE "RankGroup_new" RENAME TO "RankGroup";

-- ---------------------------------------------------------------------------
-- Phase 1d: explicit business mapping BEFORE salary_records remap
-- ---------------------------------------------------------------------------
UPDATE "civil_servant_ranks"
SET
  "rankGroup" = CASE "code"
    WHEN 'V.09.02.05' THEN 'A3_2'::"RankGroup"
    WHEN 'V.09.02.06' THEN 'A2_1'::"RankGroup"
    WHEN 'V.09.02.04' THEN 'A0'::"RankGroup"
    WHEN 'V.09.02.08' THEN 'A0'::"RankGroup"
    WHEN '01.004' THEN 'A0'::"RankGroup"
    WHEN '01.005' THEN 'B'::"RankGroup"
    ELSE "rankGroup"
  END,
  "minCoefficient" = CASE "code"
    WHEN 'V.09.02.05' THEN 5.75
    WHEN 'V.09.02.06' THEN 4.40
    WHEN 'V.09.02.04' THEN 2.10
    WHEN 'V.09.02.08' THEN 2.10
    WHEN '01.004' THEN 2.10
    WHEN '01.005' THEN 1.86
    ELSE "minCoefficient"
  END,
  "maxCoefficient" = CASE "code"
    WHEN 'V.09.02.05' THEN 7.55
    WHEN 'V.09.02.06' THEN 6.78
    WHEN 'V.09.02.04' THEN 4.89
    WHEN 'V.09.02.08' THEN 4.89
    WHEN '01.004' THEN 4.89
    WHEN '01.005' THEN 4.06
    ELSE "maxCoefficient"
  END;

-- ---------------------------------------------------------------------------
-- Phase 2: rebuild civil_servant_rank_steps by rankGroup
-- ---------------------------------------------------------------------------
CREATE TABLE "civil_servant_rank_steps_new" (
  "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::text,
  "rankGroup" "RankGroup" NOT NULL,
  "level" INTEGER NOT NULL,
  "coefficient" DECIMAL(5,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "civil_servant_rank_steps_new_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "civil_servant_rank_steps_new_rankGroup_level_key" UNIQUE ("rankGroup", "level")
);

INSERT INTO "civil_servant_rank_steps_new" ("rankGroup", "level", "coefficient", "isActive", "updatedAt") VALUES
  -- A3_1 (1-6)
  ('A3_1', 1, 6.20, true, CURRENT_TIMESTAMP),
  ('A3_1', 2, 6.56, true, CURRENT_TIMESTAMP),
  ('A3_1', 3, 6.92, true, CURRENT_TIMESTAMP),
  ('A3_1', 4, 7.28, true, CURRENT_TIMESTAMP),
  ('A3_1', 5, 7.64, true, CURRENT_TIMESTAMP),
  ('A3_1', 6, 8.00, true, CURRENT_TIMESTAMP),
  -- A3_2 (1-6)
  ('A3_2', 1, 5.75, true, CURRENT_TIMESTAMP),
  ('A3_2', 2, 6.11, true, CURRENT_TIMESTAMP),
  ('A3_2', 3, 6.47, true, CURRENT_TIMESTAMP),
  ('A3_2', 4, 6.83, true, CURRENT_TIMESTAMP),
  ('A3_2', 5, 7.19, true, CURRENT_TIMESTAMP),
  ('A3_2', 6, 7.55, true, CURRENT_TIMESTAMP),
  -- A2_1 (1-8)
  ('A2_1', 1, 4.40, true, CURRENT_TIMESTAMP),
  ('A2_1', 2, 4.74, true, CURRENT_TIMESTAMP),
  ('A2_1', 3, 5.08, true, CURRENT_TIMESTAMP),
  ('A2_1', 4, 5.42, true, CURRENT_TIMESTAMP),
  ('A2_1', 5, 5.76, true, CURRENT_TIMESTAMP),
  ('A2_1', 6, 6.10, true, CURRENT_TIMESTAMP),
  ('A2_1', 7, 6.44, true, CURRENT_TIMESTAMP),
  ('A2_1', 8, 6.78, true, CURRENT_TIMESTAMP),
  -- A2_2 (1-8)
  ('A2_2', 1, 4.00, true, CURRENT_TIMESTAMP),
  ('A2_2', 2, 4.34, true, CURRENT_TIMESTAMP),
  ('A2_2', 3, 4.68, true, CURRENT_TIMESTAMP),
  ('A2_2', 4, 5.02, true, CURRENT_TIMESTAMP),
  ('A2_2', 5, 5.36, true, CURRENT_TIMESTAMP),
  ('A2_2', 6, 5.70, true, CURRENT_TIMESTAMP),
  ('A2_2', 7, 6.04, true, CURRENT_TIMESTAMP),
  ('A2_2', 8, 6.38, true, CURRENT_TIMESTAMP),
  -- A1 (1-9)
  ('A1', 1, 2.34, true, CURRENT_TIMESTAMP),
  ('A1', 2, 2.67, true, CURRENT_TIMESTAMP),
  ('A1', 3, 3.00, true, CURRENT_TIMESTAMP),
  ('A1', 4, 3.33, true, CURRENT_TIMESTAMP),
  ('A1', 5, 3.66, true, CURRENT_TIMESTAMP),
  ('A1', 6, 3.99, true, CURRENT_TIMESTAMP),
  ('A1', 7, 4.32, true, CURRENT_TIMESTAMP),
  ('A1', 8, 4.65, true, CURRENT_TIMESTAMP),
  ('A1', 9, 4.98, true, CURRENT_TIMESTAMP),
  -- A0 (1-10)
  ('A0', 1, 2.10, true, CURRENT_TIMESTAMP),
  ('A0', 2, 2.41, true, CURRENT_TIMESTAMP),
  ('A0', 3, 2.72, true, CURRENT_TIMESTAMP),
  ('A0', 4, 3.03, true, CURRENT_TIMESTAMP),
  ('A0', 5, 3.34, true, CURRENT_TIMESTAMP),
  ('A0', 6, 3.65, true, CURRENT_TIMESTAMP),
  ('A0', 7, 3.96, true, CURRENT_TIMESTAMP),
  ('A0', 8, 4.27, true, CURRENT_TIMESTAMP),
  ('A0', 9, 4.58, true, CURRENT_TIMESTAMP),
  ('A0', 10, 4.89, true, CURRENT_TIMESTAMP),
  -- B (1-12)
  ('B', 1, 1.86, true, CURRENT_TIMESTAMP),
  ('B', 2, 2.06, true, CURRENT_TIMESTAMP),
  ('B', 3, 2.26, true, CURRENT_TIMESTAMP),
  ('B', 4, 2.46, true, CURRENT_TIMESTAMP),
  ('B', 5, 2.66, true, CURRENT_TIMESTAMP),
  ('B', 6, 2.86, true, CURRENT_TIMESTAMP),
  ('B', 7, 3.06, true, CURRENT_TIMESTAMP),
  ('B', 8, 3.26, true, CURRENT_TIMESTAMP),
  ('B', 9, 3.46, true, CURRENT_TIMESTAMP),
  ('B', 10, 3.66, true, CURRENT_TIMESTAMP),
  ('B', 11, 3.86, true, CURRENT_TIMESTAMP),
  ('B', 12, 4.06, true, CURRENT_TIMESTAMP);

-- Remap salary record rankStepId old -> new by mapped rankGroup + level
UPDATE "salary_records" sr
SET "rankStepId" = sn."id"
FROM "civil_servant_rank_steps" old
JOIN "civil_servant_ranks" r
  ON old."rankId" = r."id"
JOIN "civil_servant_rank_steps_new" sn
  ON sn."rankGroup" = r."rankGroup"
 AND sn."level" = old."level"
WHERE sr."rankStepId" = old."id";

ALTER TABLE "salary_records" DROP CONSTRAINT IF EXISTS "salary_records_rankStepId_fkey";
DROP TABLE "civil_servant_rank_steps";
ALTER TABLE "civil_servant_rank_steps_new" RENAME TO "civil_servant_rank_steps";

ALTER TABLE "salary_records"
  ADD CONSTRAINT "salary_records_rankStepId_fkey"
  FOREIGN KEY ("rankStepId") REFERENCES "civil_servant_rank_steps"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
