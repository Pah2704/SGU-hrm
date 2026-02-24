'use client';

import { isAxiosError } from 'axios';
import { Check, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { LeaveRequestForm, type LeaveRequestFormState } from '@/components/leaves/leave-request-form';
import { ManagementModuleShell } from '@/components/modules/management-module-shell';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { getAuthSnapshot, hasAnyPermission, hasAnyRole } from '@/lib/authz';
import { employeesService } from '@/services/employees.service';
import { leavesService } from '@/services/leaves.service';
import type { CreateLeaveRequestPayload, LeaveRequest, LeaveStatus } from '@/types/leaves';

type ApprovalAction = 'APPROVED' | 'REJECTED';

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

const MANAGE_LEAVE_PERMISSIONS = ['leaves:read', 'leaves:read_unit', 'leaves:approve'];

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

export default function LeaveManagementPage() {
  const [listView, setListView] = useState<'pending' | 'all'>('pending');
  const [allStatusFilter, setAllStatusFilter] = useState<LeaveStatus | 'ALL'>(
    'ALL',
  );
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [createEmployeeId, setCreateEmployeeId] = useState('');
  const [formState, setFormState] = useState<LeaveRequestFormState>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const authSnapshot = useMemo(() => getAuthSnapshot(), []);
  const canManageLeaves = hasAnyPermission(
    authSnapshot.permissions,
    MANAGE_LEAVE_PERMISSIONS,
  );
  const canApprove = authSnapshot.permissions.has('leaves:approve');
  const canCreateForEmployee =
    canApprove && hasAnyRole(authSnapshot.roles, ['HR_ADMIN', 'SUPER_ADMIN']);

  const pendingQuery = useMemo(
    () => ({
      page: 1,
      limit: 100,
      status: 'PENDING' as const,
      employeeId: employeeFilter === 'ALL' ? undefined : employeeFilter,
    }),
    [employeeFilter],
  );

  const {
    data: pendingResponse,
    error: pendingError,
    isLoading: isPendingLoading,
    mutate: mutatePending,
  } = useSWR(canManageLeaves ? ['leaves-manage-pending', pendingQuery] : null, () =>
    leavesService.getApprovalQueue(pendingQuery),
  );

  const allQuery = useMemo(
    () => ({
      page: 1,
      limit: 100,
      status: allStatusFilter === 'ALL' ? undefined : allStatusFilter,
      employeeId: employeeFilter === 'ALL' ? undefined : employeeFilter,
    }),
    [allStatusFilter, employeeFilter],
  );

  const {
    data: allResponse,
    error: allError,
    isLoading: isAllLoading,
    mutate: mutateAll,
  } = useSWR(canManageLeaves ? ['leaves-manage-all', allQuery] : null, () =>
    leavesService.getApprovalQueue(allQuery),
  );

  const { data: leaveTypes = [] } = useSWR('leave-types', () =>
    leavesService.getLeaveTypes(),
  );

  const { data: employeesResponse } = useSWR(
    canManageLeaves ? ['leaves-manage-employees'] : null,
    () => employeesService.getAll({ page: 1, limit: 200 }),
  );

  const employees = useMemo(
    () => employeesResponse?.data ?? [],
    [employeesResponse?.data],
  );
  const pendingRequests = useMemo(
    () => pendingResponse?.data ?? [],
    [pendingResponse?.data],
  );
  const pendingTotal = pendingResponse?.meta.total ?? 0;
  const allRequests = useMemo(() => allResponse?.data ?? [], [allResponse?.data]);
  const allTotal = allResponse?.meta.total ?? 0;

  useEffect(() => {
    if (!leaveTypes.length) {
      return;
    }

    setFormState((previous) => {
      if (previous.leaveTypeId) {
        return previous;
      }

      return {
        ...previous,
        leaveTypeId: leaveTypes[0].id,
      };
    });
  }, [leaveTypes]);

  useEffect(() => {
    if (!employees.length) {
      return;
    }

    setCreateEmployeeId((previous) => {
      if (previous) {
        return previous;
      }

      return employees[0].id;
    });
  }, [employees]);

  const refreshAll = async () => {
    await Promise.all([mutatePending(), mutateAll()]);
  };

  const openApprovalModal = (request: LeaveRequest, action: ApprovalAction) => {
    setSelectedRequest(request);
    setSelectedAction(action);
    setApprovalNote('');
    setIsApprovalModalOpen(true);
  };

  const submitApproval = async () => {
    if (!selectedRequest || !selectedAction) {
      return;
    }

    setIsApproving(true);
    try {
      await leavesService.approveLeaveRequest(selectedRequest.id, {
        status: selectedAction,
        note: approvalNote.trim() || undefined,
      });
      toast.success(
        selectedAction === 'APPROVED'
          ? 'Da duyet don nghi phep'
          : 'Da tu choi don nghi phep',
      );
      setIsApprovalModalOpen(false);
      await Promise.all([mutatePending(), mutateAll()]);
    } catch (error) {
      toast.error('Khong the cap nhat trang thai don nghi', {
        description: getErrorMessage(error, 'Vui long thu lai.'),
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreateLeaveRequest = async () => {
    if (!canCreateForEmployee) {
      toast.error('Ban khong co quyen tao nghi phep cho nhan su khac.');
      return;
    }

    if (!createEmployeeId) {
      toast.error('Vui long chon nhan su.');
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

    setIsCreating(true);
    try {
      await leavesService.createLeaveRequest(createEmployeeId, payload);
      toast.success('Da tao don nghi phep cho nhan su.');
      setFormState((previous) => ({
        ...previous,
        fromDate: '',
        toDate: '',
        reason: '',
      }));
      await Promise.all([mutatePending(), mutateAll()]);
    } catch (error) {
      toast.error('Khong the tao don nghi phep', {
        description: getErrorMessage(error, 'Vui long thu lai.'),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const renderEmployeeFilter = (
    <Card>
      <CardHeader>
        <CardTitle>Bo loc chung</CardTitle>
        <CardDescription>
          Bo loc nhan su duoc ap dung cho ca danh sach cho duyet va tat ca trang thai.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-md">
        <div className="space-y-2">
          <Label htmlFor="manage-leave-employee-filter">Nhan su</Label>
          <select
            id="manage-leave-employee-filter"
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="ALL">Tat ca nhan su</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName} ({employee.employeeCode})
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );

  const renderAllStatusFilter = (
    <Card>
      <CardHeader>
        <CardTitle>Bo loc trang thai</CardTitle>
        <CardDescription>
          Su dung bo loc nay de thu hep danh sach tat ca trang thai.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-sm">
        <Label htmlFor="manage-leave-all-status">Trang thai</Label>
        <select
          id="manage-leave-all-status"
          value={allStatusFilter}
          onChange={(event) =>
            setAllStatusFilter(event.target.value as LeaveStatus | 'ALL')
          }
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">Tat ca</option>
          <option value="PENDING">Cho duyet</option>
          <option value="APPROVED">Da duyet</option>
          <option value="REJECTED">Tu choi</option>
        </select>
      </CardContent>
    </Card>
  );

  const renderRequestTable = ({
    title,
    description,
    requests,
    total,
    error,
    isLoading,
    showActions,
    emptyMessage,
  }: {
    title: string;
    description: string;
    requests: LeaveRequest[];
    total: number;
    error: unknown;
    isLoading: boolean;
    showActions: boolean;
    emptyMessage: string;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
                <TableHead>Nhan su</TableHead>
                <TableHead>Don vi</TableHead>
                <TableHead>Loai nghi</TableHead>
                <TableHead>Thoi gian</TableHead>
                <TableHead>So ngay</TableHead>
                <TableHead>Trang thai</TableHead>
                <TableHead className="text-right">Thao tac</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length ? (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">{request.employee?.fullName ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">
                        {request.employee?.employeeCode ?? '-'}
                      </div>
                    </TableCell>
                    <TableCell>{request.employee?.unit?.name ?? '-'}</TableCell>
                    <TableCell>{request.leaveType?.name ?? '-'}</TableCell>
                    <TableCell>
                      {new Date(request.startDate).toLocaleDateString('vi-VN')} -{' '}
                      {new Date(request.endDate).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell>{request.totalDays}</TableCell>
                    <TableCell>{statusCell(request.status)}</TableCell>
                    <TableCell className="text-right">
                      {showActions && canApprove && request.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openApprovalModal(request, 'APPROVED')}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Duyet
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openApprovalModal(request, 'REJECTED')}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Tu choi
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  if (!canManageLeaves) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Ban khong co quyen truy cap chuc nang quan ly nghi phep.
      </div>
    );
  }

  const managementTabs = [
    {
      value: 'list',
      label: 'Danh sach',
      content: (
        <>
          {renderEmployeeFilter}

          <Tabs
            value={listView}
            onValueChange={(value) => setListView(value as 'pending' | 'all')}
          >
            <TabsList>
              <TabsTrigger value="pending">
                Don cho duyet
                <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--status-pending)]/15 px-1.5 text-xs font-semibold leading-5 text-[var(--status-pending)]">
                  {pendingTotal}
                </span>
              </TabsTrigger>
              <TabsTrigger value="all">
                Tat ca trang thai
                <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold leading-5 text-muted-foreground">
                  {allTotal}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {renderRequestTable({
                title: 'Danh sach don cho duyet',
                description:
                  'Tap trung xu ly cac don dang o trang thai Cho duyet.',
                requests: pendingRequests,
                total: pendingTotal,
                error: pendingError,
                isLoading: isPendingLoading,
                showActions: true,
                emptyMessage: 'Khong co don nghi cho duyet.',
              })}
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              {renderAllStatusFilter}
              {renderRequestTable({
                title: 'Danh sach tat ca trang thai',
                description:
                  'Tong hop don nghi phep theo bo loc trang thai va nhan su.',
                requests: allRequests,
                total: allTotal,
                error: allError,
                isLoading: isAllLoading,
                showActions: false,
                emptyMessage: 'Khong co don nghi phu hop bo loc.',
              })}
            </TabsContent>
          </Tabs>
        </>
      ),
    },
    {
      value: 'create',
      label: 'Tao cho nhan su',
      hidden: !canCreateForEmployee,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Tao don nghi phep cho nhan su</CardTitle>
            <CardDescription>
              Vai tro HR Admin co the tao don nghi phep thay cho bat ky nhan su nao.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-leave-employee">Nhan su</Label>
              <select
                id="create-leave-employee"
                value={createEmployeeId}
                onChange={(event) => setCreateEmployeeId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {employees.length ? null : <option value="">Khong co du lieu nhan su</option>}
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <LeaveRequestForm
              leaveTypes={leaveTypes}
              value={formState}
              onChange={setFormState}
            />

            <div className="flex justify-end">
              <Button onClick={handleCreateLeaveRequest} disabled={isCreating || !employees.length}>
                Tao don nghi phep
              </Button>
            </div>
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <>
      <ManagementModuleShell
        title="Quan ly nghi phep"
        description="Tong hop don cho duyet, tat ca trang thai va tao nghi phep cho nhan su theo pham vi quyen."
        defaultTab="list"
        tabs={managementTabs}
        actions={
          <Button variant="outline" onClick={refreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tai lai
          </Button>
        }
      />

      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAction === 'APPROVED' ? 'Duyet don nghi phep' : 'Tu choi don nghi phep'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.employee?.fullName ?? '-'} - {selectedRequest?.leaveType?.name ?? '-'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="approval-note">Ghi chu</Label>
            <Textarea
              id="approval-note"
              value={approvalNote}
              onChange={(event) => setApprovalNote(event.target.value)}
              placeholder="Nhap ghi chu xu ly (neu co)..."
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApprovalModalOpen(false)}
              disabled={isApproving}
            >
              Huy
            </Button>
            <Button
              variant={selectedAction === 'APPROVED' ? 'default' : 'destructive'}
              onClick={submitApproval}
              disabled={isApproving}
            >
              Xac nhan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
