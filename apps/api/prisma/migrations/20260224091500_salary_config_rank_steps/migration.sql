-- Salary config: rank steps + decimal coefficients + decision traceability

CREATE TABLE "civil_servant_rank_steps" (
    "id" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "coefficient" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "civil_servant_rank_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "civil_servant_rank_steps_rankId_level_key"
ON "civil_servant_rank_steps"("rankId", "level");

ALTER TABLE "civil_servant_ranks"
  ALTER COLUMN "minCoefficient" TYPE DECIMAL(5,2) USING "minCoefficient"::DECIMAL(5,2),
  ALTER COLUMN "maxCoefficient" TYPE DECIMAL(5,2) USING "maxCoefficient"::DECIMAL(5,2);

ALTER TABLE "salary_records"
  ADD COLUMN "rankStepId" TEXT,
  ADD COLUMN "decisionNo" TEXT;

ALTER TABLE "salary_records"
  ALTER COLUMN "coefficient" TYPE DECIMAL(5,2) USING "coefficient"::DECIMAL(5,2);

CREATE UNIQUE INDEX "salary_records_employeeId_effectiveFrom_key"
ON "salary_records"("employeeId", "effectiveFrom");

ALTER TABLE "civil_servant_rank_steps"
  ADD CONSTRAINT "civil_servant_rank_steps_rankId_fkey"
  FOREIGN KEY ("rankId") REFERENCES "civil_servant_ranks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "salary_records"
  ADD CONSTRAINT "salary_records_rankStepId_fkey"
  FOREIGN KEY ("rankStepId") REFERENCES "civil_servant_rank_steps"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
