'use client';

import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { educationService } from '@/services/education.service';
import type {
  ApprovalStatus,
  CertificateRecord,
  CreateCertificatePayload,
  CreateDegreePayload,
  DegreeRecord,
  DegreeType,
} from '@/types/education';
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

interface EducationTabProps {
  employeeId: string;
  canWrite: boolean;
  canApprove: boolean;
  onChanged?: () => void;
}

type DegreeFormState = {
  degreeType: DegreeType;
  major: string;
  institution: string;
  graduationYear: string;
  degreeNumber: string;
  fileUrl: string;
};

type CertificateFormState = {
  name: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  fileUrl: string;
};

const DEGREE_TYPE_LABEL: Record<DegreeType, string> = {
  TRUNG_CAP: 'Trung cấp',
  CAO_DANG: 'Cao đẳng',
  DAI_HOC: 'Đại học',
  THAC_SI: 'Thạc sĩ',
  TIEN_SI: 'Tiến sĩ',
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

const STATUS_CLASS: Record<ApprovalStatus, string> = {
  PENDING: 'bg-[var(--status-pending)]/15 text-[var(--status-pending)]',
  APPROVED: 'bg-[var(--status-approved)]/15 text-[var(--status-approved)]',
  REJECTED: 'bg-[var(--status-rejected)]/15 text-[var(--status-rejected)]',
};

const EMPTY_DEGREE_FORM: DegreeFormState = {
  degreeType: 'DAI_HOC',
  major: '',
  institution: '',
  graduationYear: String(new Date().getFullYear()),
  degreeNumber: '',
  fileUrl: '',
};

const EMPTY_CERTIFICATE_FORM: CertificateFormState = {
  name: '',
  issuedBy: '',
  issuedDate: '',
  expiryDate: '',
  fileUrl: '',
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

export function EducationTab({
  employeeId,
  canWrite,
  canApprove,
  onChanged,
}: EducationTabProps) {
  const queryClient = useQueryClient();
  const [isDegreeModalOpen, setIsDegreeModalOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [degreeForm, setDegreeForm] = useState<DegreeFormState>(
    EMPTY_DEGREE_FORM,
  );
  const [certificateForm, setCertificateForm] = useState<CertificateFormState>(
    EMPTY_CERTIFICATE_FORM,
  );

  const { data: degrees = [], isLoading: isDegreesLoading } = useQuery({
    queryKey: ['employee-degrees', employeeId],
    queryFn: () => educationService.getDegrees(employeeId),
  });

  const { data: certificates = [], isLoading: isCertificatesLoading } = useQuery(
    {
      queryKey: ['employee-certificates', employeeId],
      queryFn: () => educationService.getCertificates(employeeId),
    },
  );

  const invalidateEducation = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['employee-degrees', employeeId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['employee-certificates', employeeId],
      }),
    ]);

    onChanged?.();
  };

  const createDegreeMutation = useMutation({
    mutationFn: (payload: CreateDegreePayload) =>
      educationService.createDegree(employeeId, payload),
    onSuccess: async () => {
      toast.success('Đã thêm văn bằng thành công');
      setDegreeForm(EMPTY_DEGREE_FORM);
      setIsDegreeModalOpen(false);
      await invalidateEducation();
    },
    onError: (error) => {
      toast.error('Không thể thêm văn bằng', {
        description: getErrorMessage(error, 'Vui lòng thử lại.'),
      });
    },
  });

  const approveDegreeMutation = useMutation({
    mutationFn: ({
      degreeId,
      status,
    }: {
      degreeId: string;
      status: ApprovalStatus;
    }) => educationService.approveDegree(degreeId, status),
    onSuccess: async (_, variables) => {
      toast.success(
        variables.status === 'APPROVED'
          ? 'Đã duyệt văn bằng'
          : 'Đã từ chối văn bằng',
      );
      await invalidateEducation();
    },
    onError: (error) => {
      toast.error('Không thể cập nhật trạng thái văn bằng', {
        description: getErrorMessage(error, 'Vui lòng thử lại.'),
      });
    },
  });

  const createCertificateMutation = useMutation({
    mutationFn: (payload: CreateCertificatePayload) =>
      educationService.createCertificate(employeeId, payload),
    onSuccess: async () => {
      toast.success('Đã thêm chứng chỉ thành công');
      setCertificateForm(EMPTY_CERTIFICATE_FORM);
      setIsCertificateModalOpen(false);
      await invalidateEducation();
    },
    onError: (error) => {
      toast.error('Không thể thêm chứng chỉ', {
        description: getErrorMessage(error, 'Vui lòng thử lại.'),
      });
    },
  });

  const approveCertificateMutation = useMutation({
    mutationFn: ({
      certificateId,
      status,
    }: {
      certificateId: string;
      status: ApprovalStatus;
    }) => educationService.approveCertificate(certificateId, status),
    onSuccess: async (_, variables) => {
      toast.success(
        variables.status === 'APPROVED'
          ? 'Đã duyệt chứng chỉ'
          : 'Đã từ chối chứng chỉ',
      );
      await invalidateEducation();
    },
    onError: (error) => {
      toast.error('Không thể cập nhật trạng thái chứng chỉ', {
        description: getErrorMessage(error, 'Vui lòng thử lại.'),
      });
    },
  });

  const highestApprovedDegree = useMemo(() => {
    const approvedDegrees = degrees.filter((degree) => degree.status === 'APPROVED');
    if (!approvedDegrees.length) {
      return 'Chưa có';
    }

    const sorted = [...approvedDegrees].sort((a, b) => {
      const order: Record<DegreeType, number> = {
        TRUNG_CAP: 1,
        CAO_DANG: 2,
        DAI_HOC: 3,
        THAC_SI: 4,
        TIEN_SI: 5,
      };

      const rankDiff = order[b.degreeType] - order[a.degreeType];
      if (rankDiff !== 0) {
        return rankDiff;
      }

      return b.graduationYear - a.graduationYear;
    });

    return DEGREE_TYPE_LABEL[sorted[0].degreeType];
  }, [degrees]);

  const handleCreateDegree = () => {
    if (!degreeForm.major.trim() || !degreeForm.institution.trim()) {
      toast.error('Vui lòng nhập đầy đủ chuyên ngành và nơi cấp');
      return;
    }

    const graduationYear = Number(degreeForm.graduationYear);
    if (!Number.isInteger(graduationYear)) {
      toast.error('Năm tốt nghiệp không hợp lệ');
      return;
    }

    createDegreeMutation.mutate({
      degreeType: degreeForm.degreeType,
      major: degreeForm.major.trim(),
      institution: degreeForm.institution.trim(),
      graduationYear,
      degreeNumber: degreeForm.degreeNumber.trim() || undefined,
      fileUrl: degreeForm.fileUrl.trim() || undefined,
    });
  };

  const handleCreateCertificate = () => {
    if (!certificateForm.name.trim() || !certificateForm.issuedBy.trim()) {
      toast.error('Vui lòng nhập đầy đủ tên chứng chỉ và nơi cấp');
      return;
    }

    createCertificateMutation.mutate({
      name: certificateForm.name.trim(),
      issuedBy: certificateForm.issuedBy.trim(),
      issuedDate: certificateForm.issuedDate
        ? new Date(`${certificateForm.issuedDate}T00:00:00`).toISOString()
        : undefined,
      expiryDate: certificateForm.expiryDate
        ? new Date(`${certificateForm.expiryDate}T00:00:00`).toISOString()
        : undefined,
      fileUrl: certificateForm.fileUrl.trim() || undefined,
    });
  };

  const renderStatusBadge = (status: ApprovalStatus) => (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );

  const renderDegreeActions = (degree: DegreeRecord) => {
    if (!canApprove || degree.status !== 'PENDING') {
      return <span className="text-xs text-muted-foreground">-</span>;
    }

    return (
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            approveDegreeMutation.mutate({
              degreeId: degree.id,
              status: 'APPROVED',
            })
          }
        >
          <Check className="mr-1 h-4 w-4" />
          Duyệt
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() =>
            approveDegreeMutation.mutate({
              degreeId: degree.id,
              status: 'REJECTED',
            })
          }
        >
          <X className="mr-1 h-4 w-4" />
          Từ chối
        </Button>
      </div>
    );
  };

  const renderCertificateActions = (certificate: CertificateRecord) => {
    if (!canApprove || certificate.status !== 'PENDING') {
      return <span className="text-xs text-muted-foreground">-</span>;
    }

    return (
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            approveCertificateMutation.mutate({
              certificateId: certificate.id,
              status: 'APPROVED',
            })
          }
        >
          <Check className="mr-1 h-4 w-4" />
          Duyệt
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() =>
            approveCertificateMutation.mutate({
              certificateId: certificate.id,
              status: 'REJECTED',
            })
          }
        >
          <X className="mr-1 h-4 w-4" />
          Từ chối
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tổng quan đào tạo</CardTitle>
          <CardDescription>
            Học vị cao nhất hiện tại: <span className="font-medium">{highestApprovedDegree}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Văn bằng</CardTitle>
            <CardDescription>Quản lý thông tin văn bằng và trạng thái duyệt.</CardDescription>
          </div>
          {canWrite ? (
            <Button onClick={() => setIsDegreeModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm văn bằng
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {isDegreesLoading ? (
            <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead>Chuyên ngành</TableHead>
                  <TableHead>Nơi cấp</TableHead>
                  <TableHead>Năm</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {degrees.length ? (
                  degrees.map((degree) => (
                    <TableRow key={degree.id}>
                      <TableCell>{DEGREE_TYPE_LABEL[degree.degreeType]}</TableCell>
                      <TableCell>{degree.major}</TableCell>
                      <TableCell>{degree.institution}</TableCell>
                      <TableCell>{degree.graduationYear}</TableCell>
                      <TableCell>{renderStatusBadge(degree.status)}</TableCell>
                      <TableCell className="text-right">
                        {renderDegreeActions(degree)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Chưa có văn bằng nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Chứng chỉ</CardTitle>
            <CardDescription>Quản lý chứng chỉ chuyên môn và nghiệp vụ.</CardDescription>
          </div>
          {canWrite ? (
            <Button onClick={() => setIsCertificateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm chứng chỉ
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {isCertificatesLoading ? (
            <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên chứng chỉ</TableHead>
                  <TableHead>Nơi cấp</TableHead>
                  <TableHead>Ngày cấp</TableHead>
                  <TableHead>Hết hạn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.length ? (
                  certificates.map((certificate) => (
                    <TableRow key={certificate.id}>
                      <TableCell>{certificate.name}</TableCell>
                      <TableCell>{certificate.issuedBy}</TableCell>
                      <TableCell>
                        {certificate.issuedDate
                          ? new Date(certificate.issuedDate).toLocaleDateString('vi-VN')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {certificate.expiryDate
                          ? new Date(certificate.expiryDate).toLocaleDateString('vi-VN')
                          : '-'}
                      </TableCell>
                      <TableCell>{renderStatusBadge(certificate.status)}</TableCell>
                      <TableCell className="text-right">
                        {renderCertificateActions(certificate)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Chưa có chứng chỉ nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDegreeModalOpen} onOpenChange={setIsDegreeModalOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Thêm văn bằng</DialogTitle>
            <DialogDescription>
              Khai báo văn bằng mới để đưa vào luồng phê duyệt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="degree-type">Loại văn bằng</Label>
              <select
                id="degree-type"
                value={degreeForm.degreeType}
                onChange={(event) =>
                  setDegreeForm((prev) => ({
                    ...prev,
                    degreeType: event.target.value as DegreeType,
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="TRUNG_CAP">Trung cấp</option>
                <option value="CAO_DANG">Cao đẳng</option>
                <option value="DAI_HOC">Đại học</option>
                <option value="THAC_SI">Thạc sĩ</option>
                <option value="TIEN_SI">Tiến sĩ</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="degree-major">Chuyên ngành</Label>
                <Input
                  id="degree-major"
                  value={degreeForm.major}
                  onChange={(event) =>
                    setDegreeForm((prev) => ({
                      ...prev,
                      major: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="degree-year">Năm tốt nghiệp</Label>
                <Input
                  id="degree-year"
                  type="number"
                  min={1900}
                  max={2100}
                  value={degreeForm.graduationYear}
                  onChange={(event) =>
                    setDegreeForm((prev) => ({
                      ...prev,
                      graduationYear: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="degree-institution">Nơi cấp</Label>
                <Input
                  id="degree-institution"
                  value={degreeForm.institution}
                  onChange={(event) =>
                    setDegreeForm((prev) => ({
                      ...prev,
                      institution: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="degree-number">Số hiệu văn bằng</Label>
                <Input
                  id="degree-number"
                  value={degreeForm.degreeNumber}
                  onChange={(event) =>
                    setDegreeForm((prev) => ({
                      ...prev,
                      degreeNumber: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="degree-file-url">URL file scan</Label>
              <Input
                id="degree-file-url"
                value={degreeForm.fileUrl}
                onChange={(event) =>
                  setDegreeForm((prev) => ({
                    ...prev,
                    fileUrl: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDegreeModalOpen(false)}
              disabled={createDegreeMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={handleCreateDegree}
              disabled={createDegreeMutation.isPending}
            >
              Lưu văn bằng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCertificateModalOpen}
        onOpenChange={setIsCertificateModalOpen}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Thêm chứng chỉ</DialogTitle>
            <DialogDescription>
              Khai báo chứng chỉ mới để đưa vào luồng phê duyệt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="certificate-name">Tên chứng chỉ</Label>
                <Input
                  id="certificate-name"
                  value={certificateForm.name}
                  onChange={(event) =>
                    setCertificateForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certificate-issued-by">Nơi cấp</Label>
                <Input
                  id="certificate-issued-by"
                  value={certificateForm.issuedBy}
                  onChange={(event) =>
                    setCertificateForm((prev) => ({
                      ...prev,
                      issuedBy: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="certificate-issued-date">Ngày cấp</Label>
                <Input
                  id="certificate-issued-date"
                  type="date"
                  value={certificateForm.issuedDate}
                  onChange={(event) =>
                    setCertificateForm((prev) => ({
                      ...prev,
                      issuedDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certificate-expiry-date">Ngày hết hạn</Label>
                <Input
                  id="certificate-expiry-date"
                  type="date"
                  value={certificateForm.expiryDate}
                  onChange={(event) =>
                    setCertificateForm((prev) => ({
                      ...prev,
                      expiryDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="certificate-file-url">URL file scan</Label>
              <Input
                id="certificate-file-url"
                value={certificateForm.fileUrl}
                onChange={(event) =>
                  setCertificateForm((prev) => ({
                    ...prev,
                    fileUrl: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCertificateModalOpen(false)}
              disabled={createCertificateMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={handleCreateCertificate}
              disabled={createCertificateMutation.isPending}
            >
              Lưu chứng chỉ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
