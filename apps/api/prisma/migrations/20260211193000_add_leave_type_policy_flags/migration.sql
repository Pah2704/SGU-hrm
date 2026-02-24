ALTER TABLE "leave_types"
ADD COLUMN "seniorityCount" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "delaySalaryRaise" BOOLEAN NOT NULL DEFAULT false;
