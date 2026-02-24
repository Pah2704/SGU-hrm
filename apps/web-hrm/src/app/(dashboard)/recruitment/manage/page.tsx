'use client';

import Link from 'next/link';
import { isAxiosError } from 'axios';
import { Plus, RefreshCw, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
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
  CampaignSummary,
  RecruitmentCampaignStatus,
} from '@/types/recruitment';
import type { TreeUnitDto } from '@/types';
import { toast } from 'sonner';
import api from '@/lib/api';

type PositionOption = {
  id: string;
  code: string;
  name: string;
};

type CampaignFormState = {
  title: string;
  description: string;
  unitId: string;
  positionId: string;
  quantity: number;
  deadline: string;
  status: RecruitmentCampaignStatus;
};

const STATUS_LABEL: Record<RecruitmentCampaignStatus, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang tuyển',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
};

const STATUS_BADGE_CLASS: Record<RecruitmentCampaignStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-[var(--status-approved)]/15 text-[var(--status-approved)]',
  CLOSED: 'bg-[var(--status-pending)]/15 text-[var(--status-pending)]',
  CANCELLED: 'bg-[var(--status-rejected)]/15 text-[var(--status-rejected)]',
};

const EMPTY_FORM: CampaignFormState = {
  title: '',
  description: '',
  unitId: '',
  positionId: '',
  quantity: 1,
  deadline: '',
  status: 'DRAFT',
};

const isValidRecruitmentStatus = (
  value: string,
): value is RecruitmentCampaignStatus =>
  value === 'DRAFT' ||
  value === 'ACTIVE' ||
  value === 'CLOSED' ||
  value === 'CANCELLED';

const mapCampaignToForm = (campaign: CampaignSummary): CampaignFormState => ({
  title: campaign.title,
  description: campaign.description ?? '',
  unitId: campaign.unitId,
  positionId: campaign.positionId ?? '',
  quantity: campaign.quantity,
  deadline: campaign.deadline.slice(0, 10),
  status: campaign.status,
});

export default function RecruitmentCampaignListPage() {
  const [statusFilter, setStatusFilter] = useState<
    RecruitmentCampaignStatus | 'ALL'
  >('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignSummary | null>(
    null,
  );
  const [formState, setFormState] = useState<CampaignFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const query = useMemo(
    () => ({
      page: 1,
      limit: 100,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: search.trim() || undefined,
    }),
    [search, statusFilter],
  );

  const {
    data: campaignResponse,
    error,
    isLoading,
    mutate,
  } = useSWR(['recruitment-campaigns', query], () =>
    recruitmentService.getCampaigns(query),
  );

  const { data: unitTree } = useSWR<TreeUnitDto[]>('units-tree', () =>
    api.get('/units').then((res) => res.data),
  );
  const { data: positions } = useSWR<PositionOption[]>('positions-options', () =>
    api.get('/positions').then((res) => res.data),
  );

  const unitOptions = useMemo(() => {
    const result: Array<{ id: string; name: string; code: string }> = [];
    const visit = (nodes: TreeUnitDto[]) => {
      for (const node of nodes) {
        if (node.code !== 'SGU' && !node.isDeleted) {
          result.push({ id: node.id, name: node.name, code: node.code });
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

  const campaigns = campaignResponse?.data ?? [];

  const openCreateModal = () => {
    const defaultUnitId = unitOptions[0]?.id ?? '';
    setEditingCampaign(null);
    setFormState({
      ...EMPTY_FORM,
      unitId: defaultUnitId,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (campaign: CampaignSummary) => {
    setEditingCampaign(campaign);
    setFormState(mapCampaignToForm(campaign));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }
    setIsModalOpen(false);
  };

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (isAxiosError<{ message?: string }>(err)) {
      return err.response?.data?.message || err.message || fallback;
    }
    if (err instanceof Error) {
      return err.message || fallback;
    }
    return fallback;
  };

  const handleSaveCampaign = async () => {
    if (!formState.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề đợt tuyển dụng');
      return;
    }
    if (!formState.unitId) {
      toast.error('Vui lòng chọn đơn vị tuyển dụng');
      return;
    }
    if (!formState.deadline) {
      toast.error('Vui lòng chọn hạn nộp hồ sơ');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim() || undefined,
        unitId: formState.unitId,
        positionId: formState.positionId || undefined,
        quantity: formState.quantity,
        deadline: new Date(`${formState.deadline}T00:00:00`).toISOString(),
        status: formState.status,
      };

      if (editingCampaign) {
        await recruitmentService.updateCampaign(editingCampaign.id, payload);
        toast.success('Đã cập nhật đợt tuyển dụng thành công');
      } else {
        await recruitmentService.createCampaign(payload);
        toast.success('Đã tạo đợt tuyển dụng thành công');
      }

      setIsModalOpen(false);
      await mutate();
    } catch (err: unknown) {
      toast.error('Không thể lưu đợt tuyển dụng', {
        description: getErrorMessage(err, 'Vui lòng thử lại.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tuyển dụng</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý chiến dịch tuyển dụng và danh sách ứng viên.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tải lại
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo chiến dịch
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
          <CardDescription>Lọc theo trạng thái hoặc từ khóa.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="campaign-search">Từ khóa</Label>
            <Input
              id="campaign-search"
              placeholder="Nhập tiêu đề chiến dịch..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-status-filter">Trạng thái</Label>
            <select
              id="campaign-status-filter"
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'ALL' || isValidRecruitmentStatus(value)) {
                  setStatusFilter(value);
                }
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ALL">Tất cả</option>
              <option value="DRAFT">Nháp</option>
              <option value="ACTIVE">Đang tuyển</option>
              <option value="CLOSED">Đã đóng</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách chiến dịch</CardTitle>
          <CardDescription>
            Tổng số: {campaignResponse?.meta.total ?? 0}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Không thể tải danh sách chiến dịch tuyển dụng.
            </div>
          ) : null}

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Vị trí</TableHead>
                  <TableHead>Số lượng</TableHead>
                  <TableHead>Hạn nộp</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ứng viên</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.length ? (
                  campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.title}</TableCell>
                      <TableCell>{campaign.unit?.name ?? '-'}</TableCell>
                      <TableCell>{campaign.position?.name ?? '-'}</TableCell>
                      <TableCell>{campaign.quantity}</TableCell>
                      <TableCell>
                        {new Date(campaign.deadline).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[campaign.status]}`}
                        >
                          {STATUS_LABEL[campaign.status]}
                        </span>
                      </TableCell>
                      <TableCell>{campaign._count?.candidates ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditModal(campaign)}>
                            Sửa
                          </Button>
                          <Button asChild size="sm">
                            <Link href={`/recruitment/${campaign.id}/candidates`}>
                              <Users className="mr-2 h-4 w-4" />
                              Ứng viên
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Chưa có chiến dịch tuyển dụng nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => (open ? setIsModalOpen(true) : closeModal())}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'Cập nhật chiến dịch' : 'Tạo chiến dịch tuyển dụng'}
            </DialogTitle>
            <DialogDescription>
              Khai báo thông tin chiến dịch và trạng thái tuyển dụng.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-title">Tiêu đề</Label>
              <Input
                id="campaign-title"
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Ví dụ: Tuyển dụng giảng viên CNTT năm 2026"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-description">Mô tả</Label>
              <Textarea
                id="campaign-description"
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Mô tả yêu cầu, quyền lợi, hồ sơ..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-unit">Đơn vị</Label>
                <select
                  id="campaign-unit"
                  value={formState.unitId}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, unitId: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Chọn đơn vị</option>
                  {unitOptions.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-position">Vị trí</Label>
                <select
                  id="campaign-position"
                  value={formState.positionId}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      positionId: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Chưa chọn</option>
                  {positions?.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name} ({position.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="campaign-quantity">Số lượng</Label>
                <Input
                  id="campaign-quantity"
                  type="number"
                  min={1}
                  value={formState.quantity}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      quantity: Number(event.target.value || 1),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-deadline">Hạn nộp</Label>
                <Input
                  id="campaign-deadline"
                  type="date"
                  value={formState.deadline}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      deadline: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-status">Trạng thái</Label>
                <select
                  id="campaign-status"
                  value={formState.status}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isValidRecruitmentStatus(value)) {
                      setFormState((prev) => ({ ...prev, status: value }));
                    }
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="DRAFT">Nháp</option>
                  <option value="ACTIVE">Đang tuyển</option>
                  <option value="CLOSED">Đã đóng</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button onClick={handleSaveCampaign} disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu chiến dịch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
