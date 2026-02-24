export type SalaryRankGroup =
  | 'A0'
  | 'A1'
  | 'A2_1'
  | 'A2_2'
  | 'A3_1'
  | 'A3_2'
  | 'B';

export interface CivilServantRank {
  id: string;
  code: string;
  name: string;
  rankType: string | null;
  category: string | null;
  sectorGroup: string | null;
  rankGroup: SalaryRankGroup;
  minCoefficient: number | null;
  maxCoefficient: number | null;
  isActive: boolean;
  legalReference: string | null;
  replacedByCode: string | null;
}

export interface CivilServantRankStep {
  id: string;
  rankGroup: SalaryRankGroup;
  level: number;
  coefficient: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  civilServantRankId: string | null;
  rankStepId: string | null;
  decisionNo: string | null;
  salaryLevel: number;
  coefficient: number;
  currentLevelDate: string;
  expectedRaiseDate: string;
  percentEnjoy: number;
  seniorityAllowance: number | null;
  positionAllowance: number | null;
  concurrentAllowance: number | null;
  otherAllowance: number | null;
  warningFlag: boolean;
  warningReason: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  civilServantRank: Pick<
    CivilServantRank,
    'id' | 'code' | 'name' | 'rankGroup' | 'isActive' | 'category'
  > | null;
  rankStep: Pick<CivilServantRankStep, 'id' | 'level' | 'coefficient' | 'isActive'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalaryRecordPayload {
  civilServantRankId: string;
  salaryLevel: number;
  currentLevelDate: string;
  effectiveFrom: string;
  decisionNo?: string;
  percentEnjoy?: number;
  seniorityAllowance?: number;
  positionAllowance?: number;
  concurrentAllowance?: number;
  otherAllowance?: number;
}

export interface CreateRankPayload {
  code: string;
  name: string;
  rankType?: string;
  category?: string;
  rankGroup: CivilServantRank['rankGroup'];
  minCoefficient?: number;
  maxCoefficient?: number;
  isActive?: boolean;
  legalReference?: string;
  replacedByCode?: string;
}

export type UpdateRankPayload = Partial<CreateRankPayload>;

export interface CreateRankStepPayload {
  level: number;
  coefficient: number;
  isActive?: boolean;
}

export type UpdateRankStepPayload = Partial<CreateRankStepPayload>;

export interface ConfigMutationResponse<T> {
  data: T;
  meta?: {
    warnings?: string[];
    [key: string]: unknown;
  };
}

/** Raise cycle in months by RankGroup */
export const RAISE_CYCLE_MONTHS: Record<SalaryRankGroup, number> = {
  A0: 36,
  A1: 36,
  A2_1: 36,
  A2_2: 36,
  A3_1: 36,
  A3_2: 36,
  B: 24,
};

/** Category labels for grouped dropdown */
export const RANK_CATEGORY_LABELS: Record<string, string> = {
  GV_DAI_HOC: 'Giảng viên Đại học',
  GV_MAM_NON: 'Giáo viên Mầm non',
  GV_TIEU_HOC: 'Giáo viên Tiểu học',
  GV_THCS: 'Giáo viên THCS',
  GV_THPT: 'Giáo viên THPT',
  GIANG_VIEN_GDNN: 'Giảng viên GDNN',
  GIAO_VIEN_GDNN: 'Giáo viên GDNN',
  Y_TE: 'Viên chức y tế',
  HANH_CHINH: 'Viên chức hành chính',
  HO_TRO_DAO_TAO: 'Hỗ trợ đào tạo',
  KHAC: 'Khác',
};
