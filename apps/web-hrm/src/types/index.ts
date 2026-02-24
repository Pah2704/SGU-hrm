export interface TreeUnitDto {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  unitType: string;
  status: string;
  isDeleted: boolean;
  deletedAt: string | null;
  level: number;
  sortOrder: number;
  parentId: string | null;
  children: TreeUnitDto[];
}

export enum UnitType {
  TRUONG = "TRUONG",
  KHOA = "KHOA",
  PHONG = "PHONG",
  BAN = "BAN",
  TRUNG_TAM = "TRUNG_TAM",
  TO_BO_MON = "TO_BO_MON",
}

export enum UnitStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  MERGED = "MERGED",
}

export * from './recruitment';
export * from './education';
export * from './leaves';
