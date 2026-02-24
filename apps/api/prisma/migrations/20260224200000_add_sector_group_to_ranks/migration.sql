-- AlterTable
ALTER TABLE "civil_servant_ranks"
ADD COLUMN IF NOT EXISTS "sector_group" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "civil_servant_ranks_sector_group_idx"
ON "civil_servant_ranks"("sector_group");

-- Backfill sector group from existing category values
UPDATE "civil_servant_ranks"
SET "sector_group" = CASE
  WHEN "category" = 'GV_DAI_HOC' THEN 'GIANG_VIEN'
  WHEN "category" IN ('GV_MAM_NON', 'GV_TIEU_HOC', 'GV_THCS', 'GV_THPT') THEN 'GIAO_VIEN_PHO_THONG'
  WHEN "category" IN ('GIANG_VIEN_GDNN', 'GIAO_VIEN_GDNN') THEN 'GIAO_VIEN_NGHE_NGHIEP'
  WHEN "category" = 'Y_TE' THEN 'Y_TE'
  WHEN "category" = 'HANH_CHINH' THEN 'HANH_CHINH'
  WHEN "category" IN ('HO_TRO_DAO_TAO', 'TU_VAN_HOC_SINH', 'HO_TRO_GD_DAC_THU', 'THIET_BI_THI_NGHIEM') THEN 'HO_TRO_DAO_TAO'
  ELSE 'KHAC'
END;
