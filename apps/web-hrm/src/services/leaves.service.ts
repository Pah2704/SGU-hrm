import api from '@/lib/api';
import type {
  ApproveLeaveRequestPayload,
  CreateLeaveRequestPayload,
  CreateLeaveTypePayload,
  LeaveRequestQuery,
  LeaveRequestsResponse,
  LeaveType,
} from '@/types/leaves';

export const leavesService = {
  getLeaveTypes: async () => {
    const { data } = await api.get<LeaveType[]>('/leave-types');
    return data;
  },

  createLeaveType: async (payload: CreateLeaveTypePayload) => {
    const { data } = await api.post<LeaveType>('/leave-types', payload);
    return data;
  },

  updateLeaveType: async (id: string, payload: Partial<CreateLeaveTypePayload>) => {
    const { data } = await api.patch<LeaveType>(`/leave-types/${id}`, payload);
    return data;
  },

  getEmployeeLeaveRequests: async (
    employeeId: string,
    params?: LeaveRequestQuery,
  ) => {
    const { data } = await api.get<LeaveRequestsResponse>(
      `/employees/${employeeId}/leave-requests`,
      { params },
    );
    return data;
  },

  createLeaveRequest: async (
    employeeId: string,
    payload: CreateLeaveRequestPayload,
  ) => {
    const { data } = await api.post(
      `/employees/${employeeId}/leave-requests`,
      payload,
    );
    return data;
  },

  getApprovalQueue: async (params?: LeaveRequestQuery) => {
    const { data } = await api.get<LeaveRequestsResponse>('/leave-requests', {
      params,
    });
    return data;
  },

  approveLeaveRequest: async (id: string, payload: ApproveLeaveRequestPayload) => {
    const { data } = await api.patch(`/leave-requests/${id}/approve`, payload);
    return data;
  },
};
