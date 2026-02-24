import api from '@/lib/api';
import type {
  CivilServantRank,
  CivilServantRankStep,
  ConfigMutationResponse,
  CreateRankPayload,
  CreateRankStepPayload,
  CreateSalaryRecordPayload,
  SalaryRankGroup,
  SalaryRecord,
  UpdateRankPayload,
  UpdateRankStepPayload,
} from '@/types/salary';

export const salaryService = {
  getRanks: async (params?: {
    active?: string;
    search?: string;
    category?: string;
    sectorGroup?: string;
  }) => {
    const { data } = await api.get<CivilServantRank[]>(
      '/civil-servant-ranks',
      { params },
    );
    return data;
  },

  getSectors: async () => {
    const { data } = await api.get<string[]>('/civil-servant-ranks/sectors');
    return data;
  },

  createRank: async (payload: CreateRankPayload) => {
    const { data } = await api.post<ConfigMutationResponse<CivilServantRank>>(
      '/civil-servant-ranks',
      payload,
    );
    return data;
  },

  updateRank: async (rankId: string, payload: UpdateRankPayload) => {
    const { data } = await api.patch<ConfigMutationResponse<CivilServantRank>>(
      `/civil-servant-ranks/${rankId}`,
      payload,
    );
    return data;
  },

  getRankSteps: async (
    rankGroup: SalaryRankGroup,
    params?: {
      active?: string;
    },
  ) => {
    const { data } = await api.get<CivilServantRankStep[]>(
      `/salary-scale/${rankGroup}/steps`,
      { params },
    );
    return data;
  },

  createRankStep: async (
    rankGroup: SalaryRankGroup,
    payload: CreateRankStepPayload,
  ) => {
    const { data } = await api.post<ConfigMutationResponse<CivilServantRankStep>>(
      `/salary-scale/${rankGroup}/steps`,
      payload,
    );
    return data;
  },

  updateRankStep: async (stepId: string, payload: UpdateRankStepPayload) => {
    const { data } = await api.patch<ConfigMutationResponse<CivilServantRankStep>>(
      `/civil-servant-rank-steps/${stepId}`,
      payload,
    );
    return data;
  },

  getRecords: async (employeeId: string) => {
    const { data } = await api.get<SalaryRecord[]>(
      `/employees/${employeeId}/salary-records`,
    );
    return data;
  },

  createRecord: async (
    employeeId: string,
    payload: CreateSalaryRecordPayload,
  ) => {
    const { data } = await api.post<SalaryRecord>(
      `/employees/${employeeId}/salary-records`,
      payload,
    );
    return data;
  },
};
