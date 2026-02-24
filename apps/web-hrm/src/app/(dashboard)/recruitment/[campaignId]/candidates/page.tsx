'use client';

import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, RefreshCw, UserPlus, UserRoundCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { recruitmentService } from '@/services/recruitment.service';
import type {
  CandidateStatus,
  CandidateSummary,
  ConvertCandidatePayload,
  CreateCandidatePayload,
} from '@/types/recruitment';
import type { TreeUnitDto } from '@/types';
import { toast } from 'sonner';
import api from '@/lib/api';

type ConvertFormState = {
  employeeCode: string;
  fullName: string;
  citizenId: string;
  dob: string;
  gender: '' | 'NAM' | 'NU';
  email: string;
  phone: string;
  unitId: string;
};

type CandidateFormState = {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: '' | 'NAM' | 'NU';
  citizenId: string;
  currentAddress: string;
  cvFileUrl: string;
};

const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  APPLIED: 'Đã nộp',
  REVIEWING: 'Đang xem hồ sơ',
  INTERVIEWED: 'Đã phỏng vấn',
  ACCEPTED: 'Đạt',
  REJECTED: 'Không đạt',
  CONVERTED: 'Đã chuyển nhân sự',
};

const CANDIDATE_STATUS_CLASS: Record<CandidateStatus, string> = {
  APPLIED: 'bg-muted text-muted-foreground',
  REVIEWING: 'bg-[var(--brand-sky)] text-[var(--brand-navy)]',
  INTERVIEWED: 'bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)]',
  ACCEPTED: 'bg-[var(--status-approved)]/15 text-[var(--status-approved)]',
  REJECTED: 'bg-[var(--status-rejected)]/15 text-[var(--status-rejected)]',
  CONVERTED: 'bg-[var(--status-pending)]/15 text-[var(--status-pending)]',
};

const EMPTY_CANDIDATE_FORM: CandidateFormState = {
  fullName: '',
  email: '',
  phone: '',
  dob: '',
  gender: '',
  citizenId: '',
  currentAddress: '',
  cvFileUrl: '',
};

const EMPTY_CONVERT_FORM: ConvertFormState = {
  employeeCode: '',
  fullName: '',
  citizenId: '',
  dob: '',
  gender: '',
  email: '',
  phone: '',
  unitId: '',
};

const isValidCandidateStatus = (value: string): value is CandidateStatus =>
  value === 'APPLIED' ||
  value === 'REVIEWING' ||
  value === 'INTERVIEWED' ||
  value === 'ACCEPTED' ||
  value === 'REJECTED' ||
  value === 'CONVERTED';

export default function CampaignCandidatesPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params?.campaignId;

  const [statusFilter, setStatusFilter] = useState<CandidateStatus | 'ALL'>(
    'ALL',
  );
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateFormState, setCandidateFormState] =
    useState<CandidateFormState>(EMPTY_CANDIDATE_FORM);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateSummary | null>(null);
  const [convertFormState, setConvertFormState] =
    useState<ConvertFormState>(EMPTY_CONVERT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const query = useMemo(
    () => ({
      page: 1,
      limit: 100,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    }),
    [statusFilter],
  );

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR(
    campaignId ? ['campaign-candidates', campaignId, query] : null,
    () => recruitmentService.getCandidates(campaignId!, query),
  );

  const { data: unitTree } = useSWR<TreeUnitDto[]>('units-tree', () =>
    api.get('/units').then((res) => res.data),
  );

  const unitOptions = useMemo(() => {
    const result: Array<{ id: string; name: string }> = [];
    const visit = (nodes: TreeUnitDto[]) => {
      for (const node of nodes) {
        if (node.code !== 'SGU' && !node.isDeleted) {
          result.push({ id: node.id, name: node.name });
        }
        if (node.children?.length) {
          visit(node.children);
        }
      }
    };

    if (unitTree?.length) {
      visit(unitTree);
    }
    return result;
  }, [unitTree]);

  const candidates = response?.data ?? [];

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (isAxiosError<{ message?: string }>(err)) {
      return err.response?.data?.message || err.message || fallback;
    }
    if (err instanceof Error) {
      return err.message || fallback;
    }
    return fallback;
  };

  const openCandidateModal = () => {
    setCandidateFormState(EMPTY_CANDIDATE_FORM);
    setIsCandidateModalOpen(true);
  };

  const closeCandidateModal = () => {
    if (!isSubmitting) {
      setIsCandidateModalOpen(false);
    }
  };

  const handleCreateCandidate = async () => {
    if (!campaignId) {
      return;
    }
    if (!candidateFormState.fullName.trim() || !candidateFormState.email.trim()) {
      toast.error('Vui lòng nhập họ tên và email ứng viên');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateCandidatePayload = {
        fullName: candidateFormState.fullName.trim(),
        email: candidateFormState.email.trim(),
        phone: candidateFormState.phone.trim() || undefined,
        dob: candidateFormState.dob
          ? new Date(`${candidateFormState.dob}T00:00:00`).toISOString()
          : undefined,
        gender: candidateFormState.gender || undefined,
        citizenId: candidateFormState.citizenId.trim() || undefined,
        currentAddress: candidateFormState.currentAddress.trim() || undefined,
        cvFileUrl: candidateFormState.cvFileUrl.trim() || undefined,
      };

      await recruitmentService.createCandidate(campaignId, payload);
      toast.success('Đã thêm ứng viên thành công');
      setIsCandidateModalOpen(false);
      await mutate();
    } catch (err: unknown) {
      toast.error('Không thể thêm ứng viên', {
        description: getErrorMessage(err, 'Vui lòng thử lại.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: CandidateStatus) => {
    try {
      await recruitmentService.updateCandidateStatus(id, status);
      toast.success('Đã cập nhật trạng thái ứng viên thành công');
      await mutate();
    } catch (err: unknown) {
      toast.error('Không thể cập nhật trạng thái', {
        description: getErrorMessage(err, 'Vui lòng thử lại.'),
      });
    }
  };

  const openConvertModal = (candidate: CandidateSummary) => {
    setSelectedCandidate(candidate);
    setConvertFormState({
      employeeCode: '',
      fullName: candidate.fullName ?? '',
      citizenId: candidate.citizenId ?? '',
      dob: candidate.dob ? candidate.dob.slice(0, 10) : '',
      gender: candidate.gender ?? '',
      email: candidate.email ?? '',
      phone: candidate.phone ?? '',
      unitId: '',
    });
    setIsConvertModalOpen(true);
  };

  const closeConvertModal = () => {
    if (!isSubmitting) {
      setIsConvertModalOpen(false);
      setSelectedCandidate(null);
    }
  };

  const handleConvertCandidate = async () => {
    if (!selectedCandidate) {
      return;
    }
    if (!convertFormState.employeeCode.trim()) {
      toast.error('Vui lòng nhập mã viên chức');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ConvertCandidatePayload = {
        employeeCode: convertFormState.employeeCode.trim(),
        fullName: convertFormState.fullName.trim() || undefined,
        citizenId: convertFormState.citizenId.trim() || undefined,
        dob: convertFormState.dob
          ? new Date(`${convertFormState.dob}T00:00:00`).toISOString()
          : undefined,
        gender: convertFormState.gender || undefined,
        email: convertFormState.email.trim() || undefined,
        phone: convertFormState.phone.trim() || undefined,
        unitId: convertFormState.unitId || undefined,
      };

      await recruitmentService.convertCandidate(selectedCandidate.id, payload);
      toast.success('Đã chuyển ứng viên thành nhân sự thành công');
      setIsConvertModalOpen(false);
      setSelectedCandidate(null);
      await mutate();
    } catch (err: unknown) {
      toast.error('Không thể chuyển ứng viên', {
        description: getErrorMessage(err, 'Vui lòng kiểm tra dữ liệu bắt buộc.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!campaignId) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Thiếu mã chiến dịch tuyển dụng.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" className="mb-2 pl-0">
            <Link href="/recruitment/manage">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại danh sách chiến dịch
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý ứng viên</h1>
          <p className="text-muted-foreground">
            Chiến dịch: <span className="font-medium">{campaignId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tải lại
          </Button>
          <Button onClick={openCandidateModal}>
            <UserPlus className="mr-2 h-4 w-4" />
            Thêm ứng viên
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc ứng viên</CardTitle>
          <CardDescription>Lọc theo trạng thái xử lý hồ sơ.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm">
          <Label htmlFor="candidate-status-filter">Trạng thái</Label>
          <select
            id="candidate-status-filter"
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'ALL' || isValidCandidateStatus(value)) {
                setStatusFilter(value);
              }
            }}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="ALL">Tất cả</option>
            <option value="APPLIED">Đã nộp</option>
            <option value="REVIEWING">Đang xem hồ sơ</option>
            <option value="INTERVIEWED">Đã phỏng vấn</option>
            <option value="ACCEPTED">Đạt</option>
            <option value="REJECTED">Không đạt</option>
            <option value="CONVERTED">Đã chuyển nhân sự</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ứng viên</CardTitle>
          <CardDescription>Tổng số: {response?.meta.total ?? 0}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Không thể tải danh sách ứng viên.
            </div>
          ) : null}

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày nộp</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.length ? (
                  candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">{candidate.fullName}</TableCell>
                      <TableCell>{candidate.email}</TableCell>
                      <TableCell>{candidate.phone || '-'}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${CANDIDATE_STATUS_CLASS[candidate.status]}`}
                        >
                          {CANDIDATE_STATUS_LABEL[candidate.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(candidate.appliedAt).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <select
                            value={candidate.status}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (isValidCandidateStatus(value)) {
                                void handleStatusChange(candidate.id, value);
                              }
                            }}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            disabled={candidate.status === 'CONVERTED'}
                          >
                            <option value="APPLIED">Đã nộp</option>
                            <option value="REVIEWING">Đang xem hồ sơ</option>
                            <option value="INTERVIEWED">Đã phỏng vấn</option>
                            <option value="ACCEPTED">Đạt</option>
                            <option value="REJECTED">Không đạt</option>
                            <option value="CONVERTED">Đã chuyển</option>
                          </select>
                          {candidate.status !== 'CONVERTED' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openConvertModal(candidate)}
                            >
                              <UserRoundCheck className="mr-2 h-4 w-4" />
                              Chuyển
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Chưa có ứng viên nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCandidateModalOpen} onOpenChange={(open) => (open ? setIsCandidateModalOpen(true) : closeCandidateModal())}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Thêm ứng viên</DialogTitle>
            <DialogDescription>
              Tạo hồ sơ ứng viên nội bộ cho chiến dịch tuyển dụng.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="candidate-name">Họ và tên</Label>
                <Input
                  id="candidate-name"
                  value={candidateFormState.fullName}
                  onChange={(event) =>
                    setCandidateFormState((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate-email">Email</Label>
                <Input
                  id="candidate-email"
                  type="email"
                  value={candidateFormState.email}
                  onChange={(event) =>
                    setCandidateFormState((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="candidate-phone">Số điện thoại</Label>
                <Input
                  id="candidate-phone"
                  value={candidateFormState.phone}
                  onChange={(event) =>
                    setCandidateFormState((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate-citizen-id">CCCD</Label>
                <Input
                  id="candidate-citizen-id"
                  value={candidateFormState.citizenId}
                  onChange={(event) =>
                    setCandidateFormState((prev) => ({
                      ...prev,
                      citizenId: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="candidate-dob">Ngày sinh</Label>
                <Input
                  id="candidate-dob"
                  type="date"
                  value={candidateFormState.dob}
                  onChange={(event) =>
                    setCandidateFormState((prev) => ({
                      ...prev,
                      dob: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate-gender">Giới tính</Label>
                <select
                  id="candidate-gender"
                  value={candidateFormState.gender}
                  onChange={(event) =>
                    setCandidateFormState((prev) => ({
                      ...prev,
                      gender: event.target.value as '' | 'NAM' | 'NU',
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Chưa chọn</option>
                  <option value="NAM">Nam</option>
                  <option value="NU">Nữ</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate-cv">URL CV</Label>
                <Input
                  id="candidate-cv"
                  value={candidateFormState.cvFileUrl}
                  onChange={(event) =>
                    setCandidateFormState((prev) => ({
                      ...prev,
                      cvFileUrl: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCandidateModal} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button onClick={handleCreateCandidate} disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu ứng viên'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConvertModalOpen} onOpenChange={(open) => (open ? setIsConvertModalOpen(true) : closeConvertModal())}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
          <DialogTitle>Chuyển ứng viên thành nhân sự</DialogTitle>
          <DialogDescription>
              Điền các trường bắt buộc để tạo nhân sự và tài khoản người dùng.
          </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="convert-employee-code">Mã viên chức *</Label>
                <Input
                  id="convert-employee-code"
                  value={convertFormState.employeeCode}
                  onChange={(event) =>
                    setConvertFormState((prev) => ({
                      ...prev,
                      employeeCode: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="convert-full-name">Họ tên</Label>
                <Input
                  id="convert-full-name"
                  value={convertFormState.fullName}
                  onChange={(event) =>
                    setConvertFormState((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="convert-email">Email</Label>
                <Input
                  id="convert-email"
                  type="email"
                  value={convertFormState.email}
                  onChange={(event) =>
                    setConvertFormState((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="convert-phone">Số điện thoại</Label>
                <Input
                  id="convert-phone"
                  value={convertFormState.phone}
                  onChange={(event) =>
                    setConvertFormState((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="convert-citizen-id">CCCD</Label>
                <Input
                  id="convert-citizen-id"
                  value={convertFormState.citizenId}
                  onChange={(event) =>
                    setConvertFormState((prev) => ({
                      ...prev,
                      citizenId: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="convert-dob">Ngày sinh</Label>
                <Input
                  id="convert-dob"
                  type="date"
                  value={convertFormState.dob}
                  onChange={(event) =>
                    setConvertFormState((prev) => ({
                      ...prev,
                      dob: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="convert-gender">Giới tính</Label>
                <select
                  id="convert-gender"
                  value={convertFormState.gender}
                  onChange={(event) =>
                    setConvertFormState((prev) => ({
                      ...prev,
                      gender: event.target.value as '' | 'NAM' | 'NU',
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Chưa chọn</option>
                  <option value="NAM">Nam</option>
                  <option value="NU">Nữ</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-unit">Đơn vị (override, tùy chọn)</Label>
              <select
                id="convert-unit"
                value={convertFormState.unitId}
                onChange={(event) =>
                  setConvertFormState((prev) => ({
                    ...prev,
                    unitId: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Dùng đơn vị của chiến dịch</option>
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeConvertModal} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button onClick={handleConvertCandidate} disabled={isSubmitting}>
              {isSubmitting ? 'Đang chuyển...' : 'Xác nhận chuyển'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
