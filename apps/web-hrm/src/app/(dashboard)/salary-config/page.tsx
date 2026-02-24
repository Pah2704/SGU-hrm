'use client';

import { isAxiosError } from 'axios';
import { Edit, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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
import { getAuthSnapshot, hasAnyPermission } from '@/lib/authz';
import { salaryService } from '@/services/salary.service';
import type {
  CivilServantRank,
  CivilServantRankStep,
  ConfigMutationResponse,
  CreateRankPayload,
  CreateRankStepPayload,
  UpdateRankPayload,
  UpdateRankStepPayload,
} from '@/types/salary';

type RankFormState = {
  code: string;
  name: string;
  rankType: string;
  category: string;
  rankGroup: CivilServantRank['rankGroup'];
  minCoefficient: string;
  maxCoefficient: string;
  legalReference: string;
  replacedByCode: string;
  isActive: boolean;
};

type StepFormState = {
  level: string;
  coefficient: string;
  isActive: boolean;
};

type DeactivateTarget =
  | { kind: 'rank'; id: string; label: string }
  | { kind: 'step'; id: string; label: string };

const SALARY_CONFIG_PERMISSION = 'salary:config_manage';
const RANK_GROUP_OPTIONS: CivilServantRank['rankGroup'][] = [
  'A0',
  'A1',
  'A2_1',
  'A2_2',
  'A3_1',
  'A3_2',
  'B',
];

const EMPTY_RANK_FORM: RankFormState = {
  code: '',
  name: '',
  rankType: '',
  category: '',
  rankGroup: 'A1',
  minCoefficient: '',
  maxCoefficient: '',
  legalReference: '',
  replacedByCode: '',
  isActive: true,
};

const EMPTY_STEP_FORM: StepFormState = {
  level: '',
  coefficient: '',
  isActive: true,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
};

const showWarnings = (response: ConfigMutationResponse<unknown>) => {
  for (const warning of response.meta?.warnings ?? []) {
    toast.warning(warning);
  }
};

export default function SalaryConfigPage() {
  const authSnapshot = useMemo(() => getAuthSnapshot(), []);
  const canManageConfig = hasAnyPermission(authSnapshot.permissions, [
    SALARY_CONFIG_PERMISSION,
  ]);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedRankId, setSelectedRankId] = useState('');
  const [selectedRankGroup, setSelectedRankGroup] =
    useState<CivilServantRank['rankGroup']>('A1');

  const [isRankModalOpen, setIsRankModalOpen] = useState(false);
  const [editingRank, setEditingRank] = useState<CivilServantRank | null>(null);
  const [rankForm, setRankForm] = useState<RankFormState>(EMPTY_RANK_FORM);
  const [isSavingRank, setIsSavingRank] = useState(false);

  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<CivilServantRankStep | null>(null);
  const [stepForm, setStepForm] = useState<StepFormState>(EMPTY_STEP_FORM);
  const [isSavingStep, setIsSavingStep] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateTarget | null>(
    null,
  );
  const [isProcessingDeactivate, setIsProcessingDeactivate] = useState(false);

  const rankQuery = useMemo(
    () => ({
      search: search.trim() || undefined,
      active: showInactive ? undefined : 'true',
    }),
    [search, showInactive],
  );

  const {
    data: ranks = [],
    error: rankError,
    isLoading: isRanksLoading,
    mutate: mutateRanks,
  } = useSWR(['salary-config-ranks', rankQuery], () =>
    salaryService.getRanks(rankQuery),
  );

  const {
    data: steps = [],
    error: stepsError,
    isLoading: isStepsLoading,
    mutate: mutateSteps,
  } = useSWR(
    selectedRankGroup
      ? ['salary-config-steps', selectedRankGroup, showInactive]
      : null,
    () =>
      salaryService.getRankSteps(selectedRankGroup, {
        active: showInactive ? undefined : 'true',
      }),
  );

  useEffect(() => {
    if (!ranks.length) {
      setSelectedRankId('');
      return;
    }

    if (selectedRankId && ranks.some((rank) => rank.id === selectedRankId)) {
      return;
    }

    const firstRank = ranks[0];
    setSelectedRankId(firstRank.id);
    setSelectedRankGroup(firstRank.rankGroup);
  }, [ranks, selectedRankId]);

  const refreshAll = async () => {
    await Promise.all([mutateRanks(), mutateSteps()]);
  };

  const openCreateRankModal = () => {
    setEditingRank(null);
    setRankForm(EMPTY_RANK_FORM);
    setIsRankModalOpen(true);
  };

  const openEditRankModal = (rank: CivilServantRank) => {
    setEditingRank(rank);
    setRankForm({
      code: rank.code,
      name: rank.name,
      rankType: rank.rankType ?? '',
      category: rank.category ?? '',
      rankGroup: rank.rankGroup,
      minCoefficient:
        rank.minCoefficient == null ? '' : String(rank.minCoefficient),
      maxCoefficient:
        rank.maxCoefficient == null ? '' : String(rank.maxCoefficient),
      legalReference: rank.legalReference ?? '',
      replacedByCode: rank.replacedByCode ?? '',
      isActive: rank.isActive,
    });
    setIsRankModalOpen(true);
  };

  const openCreateStepModal = () => {
    if (!selectedRankGroup) {
      toast.error('Vui long chon nhom truoc khi them bac.');
      return;
    }

    setEditingStep(null);
    setStepForm(EMPTY_STEP_FORM);
    setIsStepModalOpen(true);
  };

  const openEditStepModal = (step: CivilServantRankStep) => {
    setEditingStep(step);
    setStepForm({
      level: String(step.level),
      coefficient: String(step.coefficient),
      isActive: step.isActive,
    });
    setIsStepModalOpen(true);
  };

  const saveRank = async () => {
    if (!rankForm.code.trim() || !rankForm.name.trim()) {
      toast.error('Code va ten ngach la bat buoc.');
      return;
    }

    const minCoefficient = rankForm.minCoefficient.trim()
      ? Number(rankForm.minCoefficient)
      : undefined;
    const maxCoefficient = rankForm.maxCoefficient.trim()
      ? Number(rankForm.maxCoefficient)
      : undefined;

    if (
      (minCoefficient != null && Number.isNaN(minCoefficient)) ||
      (maxCoefficient != null && Number.isNaN(maxCoefficient))
    ) {
      toast.error('He so toi thieu/toi da khong hop le.');
      return;
    }

    const payload: CreateRankPayload = {
      code: rankForm.code.trim(),
      name: rankForm.name.trim(),
      rankType: rankForm.rankType.trim() || undefined,
      category: rankForm.category.trim() || undefined,
      rankGroup: rankForm.rankGroup,
      minCoefficient,
      maxCoefficient,
      legalReference: rankForm.legalReference.trim() || undefined,
      replacedByCode: rankForm.replacedByCode.trim() || undefined,
      isActive: rankForm.isActive,
    };

    setIsSavingRank(true);
    try {
      const response = editingRank
        ? await salaryService.updateRank(editingRank.id, payload as UpdateRankPayload)
        : await salaryService.createRank(payload);

      showWarnings(response);
      toast.success(editingRank ? 'Da cap nhat ngach.' : 'Da tao ngach moi.');
      setIsRankModalOpen(false);
      await mutateRanks();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Khong the luu ngach.'));
    } finally {
      setIsSavingRank(false);
    }
  };

  const saveStep = async () => {
    if (!selectedRankGroup) {
      toast.error('Khong xac dinh nhom luong.');
      return;
    }

    const level = Number(stepForm.level);
    const coefficient = Number(stepForm.coefficient);
    if (
      Number.isNaN(level) ||
      level <= 0 ||
      Number.isNaN(coefficient) ||
      coefficient < 0
    ) {
      toast.error('Bac va he so khong hop le.');
      return;
    }

    const payload: CreateRankStepPayload = {
      level,
      coefficient,
      isActive: stepForm.isActive,
    };

    setIsSavingStep(true);
    try {
      const response = editingStep
        ? await salaryService.updateRankStep(
            editingStep.id,
            payload as UpdateRankStepPayload,
          )
        : await salaryService.createRankStep(selectedRankGroup, payload);

      showWarnings(response);
      toast.success(editingStep ? 'Da cap nhat bac.' : 'Da tao bac moi.');
      setIsStepModalOpen(false);
      await mutateSteps();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Khong the luu bac luong.'));
    } finally {
      setIsSavingStep(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) {
      return;
    }

    setIsProcessingDeactivate(true);
    try {
      const response =
        deactivateTarget.kind === 'rank'
          ? await salaryService.updateRank(deactivateTarget.id, { isActive: false })
          : await salaryService.updateRankStep(deactivateTarget.id, {
              isActive: false,
            });

      showWarnings(response);
      toast.success(
        deactivateTarget.kind === 'rank'
          ? 'Da vo hieu hoa ngach.'
          : 'Da vo hieu hoa bac luong.',
      );

      setDeactivateTarget(null);
      await Promise.all([mutateRanks(), mutateSteps()]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Khong the vo hieu hoa.'));
    } finally {
      setIsProcessingDeactivate(false);
    }
  };

  const reactivateRank = async (rank: CivilServantRank) => {
    try {
      await salaryService.updateRank(rank.id, { isActive: true });
      toast.success('Da kich hoat lai ngach.');
      await mutateRanks();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Khong the kich hoat ngach.'));
    }
  };

  const reactivateStep = async (step: CivilServantRankStep) => {
    try {
      await salaryService.updateRankStep(step.id, { isActive: true });
      toast.success('Da kich hoat lai bac.');
      await mutateSteps();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Khong the kich hoat bac.'));
    }
  };

  if (!canManageConfig) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Ban khong co quyen truy cap cau hinh ngach/bac luong.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cau hinh ngach/bac luong</h1>
          <p className="text-sm text-muted-foreground">
            Quan ly danh muc ngach va bac luong de he thong tu dong suy ra he so.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tai lai
          </Button>
          <Button onClick={openCreateRankModal}>
            <Plus className="mr-2 h-4 w-4" />
            Them ngach
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bo loc</CardTitle>
          <CardDescription>Tim ngach theo ma/ten va an-hien ma het hieu luc.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="salary-config-search">Tim kiem</Label>
            <Input
              id="salary-config-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nhap ma ngach hoac ten..."
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="rounded"
              />
              Hien thi ma het hieu luc
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sach ngach</CardTitle>
          <CardDescription>Tong so: {ranks.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {rankError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Khong the tai danh sach ngach.
            </div>
          ) : null}

          {isRanksLoading ? (
            <div className="py-6 text-center text-muted-foreground">Dang tai...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Ten ngach</TableHead>
                  <TableHead>Nhom</TableHead>
                  <TableHead>He so</TableHead>
                  <TableHead>Trang thai</TableHead>
                  <TableHead className="text-right">Thao tac</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranks.length ? (
                  ranks.map((rank) => (
                    <TableRow
                      key={rank.id}
                      className={selectedRankId === rank.id ? 'bg-muted/40' : ''}
                    >
                      <TableCell>{rank.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{rank.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {rank.category || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{rank.rankGroup}</TableCell>
                      <TableCell>
                        {rank.minCoefficient ?? '-'} - {rank.maxCoefficient ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rank.isActive ? 'default' : 'secondary'}>
                          {rank.isActive ? 'Con hieu luc' : 'Het hieu luc'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRankId(rank.id);
                              setSelectedRankGroup(rank.rankGroup);
                            }}
                          >
                            Chon
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditRankModal(rank)}
                          >
                            <Edit className="mr-1 h-4 w-4" />
                            Sua
                          </Button>
                          {rank.isActive ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                setDeactivateTarget({
                                  kind: 'rank',
                                  id: rank.id,
                                  label: `${rank.code} - ${rank.name}`,
                                })
                              }
                            >
                              Vo hieu hoa
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reactivateRank(rank)}
                            >
                              Kich hoat
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Khong co ngach phu hop.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Bac luong theo nhom</CardTitle>
              <CardDescription>Dang hien thi cho nhom: {selectedRankGroup}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedRankGroup}
                onChange={(event) =>
                  setSelectedRankGroup(event.target.value as CivilServantRank['rankGroup'])
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {RANK_GROUP_OPTIONS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
              <Button onClick={openCreateStepModal} disabled={!selectedRankGroup}>
                <Plus className="mr-2 h-4 w-4" />
                Them bac
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stepsError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Khong the tai danh sach bac luong.
            </div>
          ) : null}

          {isStepsLoading ? (
            <div className="py-6 text-center text-muted-foreground">Dang tai...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bac</TableHead>
                  <TableHead>He so</TableHead>
                  <TableHead>Trang thai</TableHead>
                  <TableHead className="text-right">Thao tac</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.length ? (
                  steps.map((step) => (
                    <TableRow key={step.id}>
                      <TableCell>{step.level}</TableCell>
                      <TableCell>{step.coefficient.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={step.isActive ? 'default' : 'secondary'}>
                          {step.isActive ? 'Con hieu luc' : 'Het hieu luc'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditStepModal(step)}
                          >
                            <Edit className="mr-1 h-4 w-4" />
                            Sua
                          </Button>
                          {step.isActive ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                setDeactivateTarget({
                                  kind: 'step',
                                  id: step.id,
                                  label: `Bac ${step.level} (${step.coefficient.toFixed(2)})`,
                                })
                              }
                            >
                              Vo hieu hoa
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reactivateStep(step)}
                            >
                              Kich hoat
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Chua co bac luong cho nhom nay.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRankModalOpen} onOpenChange={setIsRankModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRank ? 'Cap nhat ngach' : 'Them ngach moi'}</DialogTitle>
            <DialogDescription>
              Quan ly thong tin ngach vien chuc va khoang he so.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={rankForm.code}
                  onChange={(event) =>
                    setRankForm((previous) => ({ ...previous, code: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ten ngach *</Label>
                <Input
                  value={rankForm.name}
                  onChange={(event) =>
                    setRankForm((previous) => ({ ...previous, name: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hang/Loai</Label>
                <Input
                  value={rankForm.rankType}
                  onChange={(event) =>
                    setRankForm((previous) => ({
                      ...previous,
                      rankType: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Danh muc</Label>
                <Input
                  value={rankForm.category}
                  onChange={(event) =>
                    setRankForm((previous) => ({
                      ...previous,
                      category: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nhom</Label>
                <select
                  value={rankForm.rankGroup}
                  onChange={(event) =>
                    setRankForm((previous) => ({
                      ...previous,
                      rankGroup: event.target.value as CivilServantRank['rankGroup'],
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {RANK_GROUP_OPTIONS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>He so min</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rankForm.minCoefficient}
                  onChange={(event) =>
                    setRankForm((previous) => ({
                      ...previous,
                      minCoefficient: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>He so max</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rankForm.maxCoefficient}
                  onChange={(event) =>
                    setRankForm((previous) => ({
                      ...previous,
                      maxCoefficient: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Can cu phap ly</Label>
              <Input
                value={rankForm.legalReference}
                onChange={(event) =>
                  setRankForm((previous) => ({
                    ...previous,
                    legalReference: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ma thay the (neu co)</Label>
              <Input
                value={rankForm.replacedByCode}
                onChange={(event) =>
                  setRankForm((previous) => ({
                    ...previous,
                    replacedByCode: event.target.value,
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rankForm.isActive}
                onChange={(event) =>
                  setRankForm((previous) => ({
                    ...previous,
                    isActive: event.target.checked,
                  }))
                }
                className="rounded"
              />
              Con hieu luc
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingRank}
              onClick={() => setIsRankModalOpen(false)}
            >
              Huy
            </Button>
            <Button type="button" disabled={isSavingRank} onClick={saveRank}>
              {isSavingRank ? 'Dang luu...' : 'Luu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStepModalOpen} onOpenChange={setIsStepModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStep ? 'Cap nhat bac' : 'Them bac moi'}</DialogTitle>
            <DialogDescription>
              Cau hinh bac va he so cua ngach dang chon.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Bac</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={stepForm.level}
                onChange={(event) =>
                  setStepForm((previous) => ({ ...previous, level: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>He so</Label>
              <Input
                type="number"
                step="0.01"
                value={stepForm.coefficient}
                onChange={(event) =>
                  setStepForm((previous) => ({
                    ...previous,
                    coefficient: event.target.value,
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stepForm.isActive}
                onChange={(event) =>
                  setStepForm((previous) => ({
                    ...previous,
                    isActive: event.target.checked,
                  }))
                }
                className="rounded"
              />
              Con hieu luc
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingStep}
              onClick={() => setIsStepModalOpen(false)}
            >
              Huy
            </Button>
            <Button type="button" disabled={isSavingStep} onClick={saveStep}>
              {isSavingStep ? 'Dang luu...' : 'Luu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xac nhan vo hieu hoa</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `Ban sap vo hieu hoa: ${deactivateTarget.label}. Tac vu nay se chan tao quyet dinh luong moi voi doi tuong nay.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingDeactivate}>Huy</AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessingDeactivate}
              onClick={confirmDeactivate}
            >
              {isProcessingDeactivate ? 'Dang xu ly...' : 'Xac nhan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
