export const VALID_SECTOR_GROUPS = [
  'GIANG_VIEN',
  'GIAO_VIEN_PHO_THONG',
  'GIAO_VIEN_NGHE_NGHIEP',
  'Y_TE',
  'HANH_CHINH',
  'HO_TRO_DAO_TAO',
  'KHAC',
] as const;

export type SectorGroup = (typeof VALID_SECTOR_GROUPS)[number];

const CATEGORY_TO_SECTOR: Record<string, SectorGroup> = {
  GV_DAI_HOC: 'GIANG_VIEN',
  GV_MAM_NON: 'GIAO_VIEN_PHO_THONG',
  GV_TIEU_HOC: 'GIAO_VIEN_PHO_THONG',
  GV_THCS: 'GIAO_VIEN_PHO_THONG',
  GV_THPT: 'GIAO_VIEN_PHO_THONG',
  GIANG_VIEN_GDNN: 'GIAO_VIEN_NGHE_NGHIEP',
  GIAO_VIEN_GDNN: 'GIAO_VIEN_NGHE_NGHIEP',
  Y_TE: 'Y_TE',
  HANH_CHINH: 'HANH_CHINH',
  HO_TRO_DAO_TAO: 'HO_TRO_DAO_TAO',
  TU_VAN_HOC_SINH: 'HO_TRO_DAO_TAO',
  HO_TRO_GD_DAC_THU: 'HO_TRO_DAO_TAO',
  THIET_BI_THI_NGHIEM: 'HO_TRO_DAO_TAO',
};

export function normalizeSectorGroup(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidSectorGroup(value: string): value is SectorGroup {
  return VALID_SECTOR_GROUPS.includes(value as SectorGroup);
}

export function deriveSectorGroup(
  category: string | null | undefined,
): SectorGroup {
  if (!category) {
    return 'KHAC';
  }

  return CATEGORY_TO_SECTOR[category.trim().toUpperCase()] ?? 'KHAC';
}
