export type RecruitmentCampaignStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'CLOSED'
  | 'CANCELLED';

export type CandidateStatus =
  | 'APPLIED'
  | 'REVIEWING'
  | 'INTERVIEWED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CONVERTED';

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CampaignSummary = {
  id: string;
  title: string;
  description?: string | null;
  unitId: string;
  positionId?: string | null;
  quantity: number;
  deadline: string;
  status: RecruitmentCampaignStatus;
  createdAt: string;
  updatedAt: string;
  unit?: {
    id: string;
    code: string;
    name: string;
  };
  position?: {
    id: string;
    code: string;
    name: string;
  } | null;
  _count?: {
    candidates: number;
  };
};

export type CandidateSummary = {
  id: string;
  campaignId: string;
  employeeId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  gender?: 'NAM' | 'NU' | null;
  citizenId?: string | null;
  currentAddress?: string | null;
  cvFileUrl?: string | null;
  source?: string | null;
  notes?: string | null;
  status: CandidateStatus;
  convertedById?: string | null;
  convertedAt?: string | null;
  appliedAt: string;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    email?: string | null;
  } | null;
};

export type CampaignListResponse = {
  data: CampaignSummary[];
  meta: PaginationMeta;
};

export type CandidateListResponse = {
  data: CandidateSummary[];
  meta: PaginationMeta;
};

export type CampaignFilters = {
  page?: number;
  limit?: number;
  status?: RecruitmentCampaignStatus;
  unitId?: string;
  search?: string;
};

export type CandidateFilters = {
  page?: number;
  limit?: number;
  status?: CandidateStatus;
};

export type CreateCampaignPayload = {
  title: string;
  description?: string;
  unitId: string;
  positionId?: string;
  quantity?: number;
  deadline: string;
  status?: RecruitmentCampaignStatus;
};

export type UpdateCampaignPayload = Partial<CreateCampaignPayload>;

export type CreateCandidatePayload = {
  fullName: string;
  email: string;
  phone?: string;
  dob?: string;
  gender?: 'NAM' | 'NU';
  citizenId?: string;
  currentAddress?: string;
  cvFileUrl?: string;
  source?: string;
  notes?: string;
  status?: CandidateStatus;
};

export type ConvertCandidatePayload = {
  employeeCode: string;
  fullName?: string;
  citizenId?: string;
  dob?: string;
  gender?: 'NAM' | 'NU';
  email?: string;
  phone?: string;
  unitId?: string;
  initialRecruitmentDate?: string;
  currentOrgJoinDate?: string;
  officialDate?: string;
  employeeStatus?: 'WORKING' | 'ON_LEAVE' | 'LONG_LEAVE' | 'RESIGNED' | 'RETIRED';
};
