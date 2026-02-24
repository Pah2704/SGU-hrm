import api from '@/lib/api';
import type {
  CandidateFilters,
  CandidateListResponse,
  CandidateStatus,
  CampaignFilters,
  CampaignListResponse,
  CampaignSummary,
  ConvertCandidatePayload,
  CreateCampaignPayload,
  CreateCandidatePayload,
  UpdateCampaignPayload,
} from '@/types/recruitment';

export const recruitmentService = {
  getCampaigns: async (params?: CampaignFilters) => {
    const { data } = await api.get<CampaignListResponse>('/recruitment/campaigns', {
      params,
    });
    return data;
  },

  createCampaign: async (payload: CreateCampaignPayload) => {
    const { data } = await api.post<CampaignSummary>('/recruitment/campaigns', payload);
    return data;
  },

  updateCampaign: async (id: string, payload: UpdateCampaignPayload) => {
    const { data } = await api.patch<CampaignSummary>(`/recruitment/campaigns/${id}`, payload);
    return data;
  },

  getCandidates: async (campaignId: string, params?: CandidateFilters) => {
    const { data } = await api.get<CandidateListResponse>(
      `/recruitment/campaigns/${campaignId}/candidates`,
      { params },
    );
    return data;
  },

  createCandidate: async (campaignId: string, payload: CreateCandidatePayload) => {
    const { data } = await api.post(`/recruitment/campaigns/${campaignId}/candidates`, payload);
    return data;
  },

  updateCandidateStatus: async (id: string, status: CandidateStatus) => {
    const { data } = await api.patch(`/recruitment/candidates/${id}/status`, { status });
    return data;
  },

  convertCandidate: async (id: string, payload: ConvertCandidatePayload) => {
    const { data } = await api.post(`/recruitment/candidates/${id}/convert`, payload);
    return data;
  },

  listPublicCampaigns: async () => {
    const { data } = await api.get<CampaignSummary[]>('/public/recruitment');
    return data;
  },

  applyPublic: async (campaignId: string, payload: CreateCandidatePayload) => {
    const { data } = await api.post(`/public/recruitment/${campaignId}/apply`, payload);
    return data;
  },
};
