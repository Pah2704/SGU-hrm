import api from '@/lib/api';
import type {
  ApprovalStatus,
  CertificateRecord,
  CreateCertificatePayload,
  CreateDegreePayload,
  DegreeRecord,
} from '@/types/education';

export const educationService = {
  getDegrees: async (employeeId: string) => {
    const { data } = await api.get<DegreeRecord[]>(
      `/employees/${employeeId}/degrees`,
    );
    return data;
  },

  createDegree: async (employeeId: string, payload: CreateDegreePayload) => {
    const { data } = await api.post<DegreeRecord>(
      `/employees/${employeeId}/degrees`,
      payload,
    );
    return data;
  },

  approveDegree: async (degreeId: string, status: ApprovalStatus) => {
    const { data } = await api.patch<DegreeRecord>(
      `/degrees/${degreeId}/approve`,
      { status },
    );
    return data;
  },

  getCertificates: async (employeeId: string) => {
    const { data } = await api.get<CertificateRecord[]>(
      `/employees/${employeeId}/certificates`,
    );
    return data;
  },

  createCertificate: async (
    employeeId: string,
    payload: CreateCertificatePayload,
  ) => {
    const { data } = await api.post<CertificateRecord>(
      `/employees/${employeeId}/certificates`,
      payload,
    );
    return data;
  },

  approveCertificate: async (
    certificateId: string,
    status: ApprovalStatus,
  ) => {
    const { data } = await api.patch<CertificateRecord>(
      `/certificates/${certificateId}/approve`,
      { status },
    );
    return data;
  },
};
