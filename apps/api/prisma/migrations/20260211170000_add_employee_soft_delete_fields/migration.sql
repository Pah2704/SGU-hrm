-- AlterTable
ALTER TABLE "employees"
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "employees_deletedAt_idx" ON "employees"("deletedAt");
