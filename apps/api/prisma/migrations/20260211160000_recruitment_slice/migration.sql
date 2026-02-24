-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecruitmentCampaignStatus') THEN
    CREATE TYPE "RecruitmentCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CandidateStatus') THEN
    CREATE TYPE "CandidateStatus" AS ENUM ('APPLIED', 'REVIEWING', 'INTERVIEWED', 'ACCEPTED', 'REJECTED', 'CONVERTED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "recruitment_campaigns" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "unitId" TEXT NOT NULL,
  "positionId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "deadline" TIMESTAMP(3) NOT NULL,
  "status" "RecruitmentCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruitment_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "candidates" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "employeeId" TEXT,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "dob" TIMESTAMP(3),
  "gender" "Gender",
  "citizenId" TEXT,
  "currentAddress" TEXT,
  "cvFileUrl" TEXT,
  "source" TEXT,
  "notes" TEXT,
  "status" "CandidateStatus" NOT NULL DEFAULT 'APPLIED',
  "convertedById" TEXT,
  "convertedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recruitment_campaigns_status_deadline_idx"
  ON "recruitment_campaigns"("status", "deadline");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recruitment_campaigns_unitId_idx"
  ON "recruitment_campaigns"("unitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidates_campaignId_status_idx"
  ON "candidates"("campaignId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidates_email_idx"
  ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_employeeId_key"
  ON "candidates"("employeeId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recruitment_campaigns_unitId_fkey'
  ) THEN
    ALTER TABLE "recruitment_campaigns"
      ADD CONSTRAINT "recruitment_campaigns_unitId_fkey"
      FOREIGN KEY ("unitId")
      REFERENCES "units"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recruitment_campaigns_positionId_fkey'
  ) THEN
    ALTER TABLE "recruitment_campaigns"
      ADD CONSTRAINT "recruitment_campaigns_positionId_fkey"
      FOREIGN KEY ("positionId")
      REFERENCES "positions"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'candidates_campaignId_fkey'
  ) THEN
    ALTER TABLE "candidates"
      ADD CONSTRAINT "candidates_campaignId_fkey"
      FOREIGN KEY ("campaignId")
      REFERENCES "recruitment_campaigns"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'candidates_employeeId_fkey'
  ) THEN
    ALTER TABLE "candidates"
      ADD CONSTRAINT "candidates_employeeId_fkey"
      FOREIGN KEY ("employeeId")
      REFERENCES "employees"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
