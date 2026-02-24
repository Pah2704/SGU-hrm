'use client';

import { isAxiosError } from 'axios';
import { CalendarPlus2, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { leavesService } from '@/services/leaves.service';
import type {
  CreateLeaveRequestPayload,
  LeaveRequest,
  LeaveStatus,
} from '@/types/leaves';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LeaveRequestForm,
  type LeaveRequestFormState,
} from '@/components/leaves/leave-request-form';

type LocalUser = {
  employee?: {
    id?: string;
  };
} | null;

const STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: 'Cho duyet',
  APPROVED: 'Da duyet',
  REJECTED: 'Tu choi',
};

const STATUS_CLASS: Record<LeaveStatus, string> = {
  PENDING: 'bg-[var(--status-pending)]/15 text-[var(--status-pending)]',
  APPROVED: 'bg-[var(--status-approved)]/15 text-[var(--status-approved)]',
  REJECTED: 'bg-[var(--status-rejected)]/15 text-[var(--status-rejected)]',
};

const EMPTY_FORM: LeaveRequestFormState = {
  leaveTypeId: '',
  fromDate: '',
  toDate: '',
  reason: '',
};

const parseStoredUser = (raw: string | null): LocalUser => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LocalUser;
  } catch {
    return null;
  }
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};

const statusCell = (status: LeaveStatus) => (
  <span
    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}
  >
    {STATUS_LABEL[status]}
  </span>
);

export default function MyLeavePage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'ALL'>('ALL');
  const [formState, setFormState] = useState<LeaveRequestFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const storedUser = useMemo(
    () => parseStoredUser(localStorage.getItem('user')),
    [],
  );
  const employeeId = storedUser?.employee?.id ?? null;

  const query = useMemo(
    () => ({
      page: 1,
      limit: 100,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    }),
    [statusFilter],
  );

  const { data: leaveTypes = [] } = useSWR('leave-types', () =>
    leavesService.getLeaveTypes(),
  );

  const {
    data: leaveResponse,
    error,
    isLoading,
    mutate,
  } = useSWR(
    employeeId ? ['my-leave-requests', employeeId, query] : null,
    () => leavesService.getEmployeeLeaveRequests(employeeId!, query),
  );

  const leaveRequests = leaveResponse?.data ?? [];
  const total = leaveResponse?.meta.total ?? 0;

  const openCreateModal = () => {
    setFormState({
      ...EMPTY_FORM,
      leaveTypeId: leaveTypes[0]?.id ?? '',
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateLeaveRequest = async () => {
    if (!employeeId) {
      toast.error('Khong tim thay ho so nhan su gan voi tai khoan.');
      return;
    }

    if (!formState.leaveTypeId || !formState.fromDate || !formState.toDate) {
      toast.error('Vui long chon loai nghi va thoi gian nghi.');
      return;
    }

    const payload: CreateLeaveRequestPayload = {
      leaveTypeId: formState.leaveTypeId,
      fromDate: new Date(`${formState.fromDate}T00:00:00`).toISOString(),
      toDate: new Date(`${formState.toDate}T00:00:00`).toISOString(),
      reason: formState.reason.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      await leavesService.createLeaveRequest(employeeId, payload);
      toast.success('Da gui don nghi phep');
      setIsCreateModalOpen(false);
      await mutate();
    } catch (err) {
      toast.error('Khong the gui don nghi phep', {
        description: getErrorMessage(err, 'Vui long thu lai.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!employeeId) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Tai khoan chua lien ket ho so nhan su, khong the su dung chuc nang nghi phep.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nghi phep cua toi</h1>
          <p className="text-sm text-muted-foreground">
            Theo doi don nghi phep va gui yeu cau nghi moi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tai lai
          </Button>
          <Button onClick={openCreateModal}>
            <CalendarPlus2 className="mr-2 h-4 w-4" />
            Tao don nghi
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bo loc</CardTitle>
          <CardDescription>Loc theo trang thai xu ly don nghi.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm">
          <Label htmlFor="leave-status-filter">Trang thai</Label>
          <select
            id="leave-status-filter"
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value as LeaveStatus | 'ALL';
              setStatusFilter(value);
            }}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="ALL">Tat ca</option>
            <option value="PENDING">Cho duyet</option>
            <option value="APPROVED">Da duyet</option>
            <option value="REJECTED">Tu choi</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sach don nghi</CardTitle>
          <CardDescription>Tong so: {total}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Khong the tai danh sach don nghi phep.
            </div>
          ) : null}

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Dang tai...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loai nghi</TableHead>
                  <TableHead>Tu ngay</TableHead>
                  <TableHead>Den ngay</TableHead>
                  <TableHead>So ngay</TableHead>
                  <TableHead>Trang thai</TableHead>
                  <TableHead>Ghi chu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.length ? (
                  leaveRequests.map((request: LeaveRequest) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.leaveType?.name ?? '-'}</TableCell>
                      <TableCell>
                        {new Date(request.startDate).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell>
                        {new Date(request.endDate).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell>{request.totalDays}</TableCell>
                      <TableCell>{statusCell(request.status)}</TableCell>
                      <TableCell>{request.notes ?? request.reason ?? '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Chua co don nghi phep nao.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Tao don nghi phep</DialogTitle>
            <DialogDescription>
              Gui don nghi phep de quan ly va HR xet duyet.
            </DialogDescription>
          </DialogHeader>

          <LeaveRequestForm
            leaveTypes={leaveTypes}
            value={formState}
            onChange={setFormState}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Huy
            </Button>
            <Button onClick={handleCreateLeaveRequest} disabled={isSubmitting}>
              Gui don
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
