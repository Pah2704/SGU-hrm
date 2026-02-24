export type LeaveCategory = 'PAID_SCHOOL' | 'PAID_BHXH' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  category: LeaveCategory;
  maxDays?: number | null;
  isPaid: boolean;
  seniorityCount: boolean;
  delaySalaryRaise: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string | null;
  status: LeaveStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  hrConfirmedBy?: string | null;
  hrConfirmedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  leaveType?: LeaveType;
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    unitId: string;
    unit?: {
      id: string;
      name: string;
    };
  };
}

export interface LeaveRequestsResponse {
  data: LeaveRequest[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface LeaveRequestQuery {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  employeeId?: string;
  unitId?: string;
}

export interface CreateLeaveRequestPayload {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

export interface ApproveLeaveRequestPayload {
  status: Extract<LeaveStatus, 'APPROVED' | 'REJECTED'>;
  note?: string;
}

export interface CreateLeaveTypePayload {
  code: string;
  name: string;
  category: LeaveCategory;
  maxDays?: number;
  isPaid?: boolean;
  seniorityCount?: boolean;
  delaySalaryRaise?: boolean;
}
