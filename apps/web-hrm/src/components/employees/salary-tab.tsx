'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AlertTriangle, Info, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { salaryService } from '@/services/salary.service';
import type {
  CivilServantRank,
  CreateSalaryRecordPayload,
  SalaryRecord,
} from '@/types/salary';
import { RANK_CATEGORY_LABELS } from '@/types/salary';

interface SalaryTabProps {
  employeeId: string;
  canWrite: boolean;
}

type RankSector =
  | 'GIANG_VIEN'
  | 'GIAO_VIEN_PHO_THONG'
  | 'GIAO_VIEN_NGHE_NGHIEP'
  | 'Y_TE'
  | 'HANH_CHINH'
  | 'HO_TRO_DAO_TAO'
  | 'KHAC';

type RankSectorFilter = 'ALL' | RankSector;

const RANK_SECTOR_ORDER: readonly RankSector[] = [
  'GIANG_VIEN',
  'GIAO_VIEN_PHO_THONG',
  'GIAO_VIEN_NGHE_NGHIEP',
  'Y_TE',
  'HANH_CHINH',
  'HO_TRO_DAO_TAO',
  'KHAC',
];

const RANK_SECTOR_LABELS: Record<RankSector, string> = {
  GIANG_VIEN: 'Giang vien dai hoc',
  GIAO_VIEN_PHO_THONG: 'Giao vien pho thong',
  GIAO_VIEN_NGHE_NGHIEP: 'Giao vien nghe nghiep',
  Y_TE: 'Y te',
  HANH_CHINH: 'Hanh chinh',
  HO_TRO_DAO_TAO: 'Ho tro dao tao',
  KHAC: 'Khac',
};

const getToday = () => new Date().toISOString().slice(0, 10);

const optionalNonNegativeNumber = (fieldLabel: string) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }
      return value;
    },
    z.coerce
      .number({ invalid_type_error: `${fieldLabel} phai la so` })
      .min(0, `${fieldLabel} phai lon hon hoac bang 0`)
      .optional(),
  );

const optionalPercentEnjoy = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  },
  z.coerce
    .number({ invalid_type_error: '% huong phai la so' })
    .min(0, '% huong phai nam trong khoang 0-100')
    .max(100, '% huong phai nam trong khoang 0-100')
    .optional(),
);

const salaryRecordFormSchema = z.object({
  civilServantRankId: z
    .string()
    .trim()
    .min(1, 'Vui long chon ngach/chuc danh vien chuc'),
  rankStepId: z.string().trim().min(1, 'Vui long chon bac luong'),
  decisionNo: z.string().trim().optional(),
  currentLevelDate: z.string().trim().min(1, 'Vui long chon ngay huong bac hien tai'),
  effectiveFrom: z.string().trim().min(1, 'Vui long chon ngay hieu luc QD'),
  percentEnjoy: optionalPercentEnjoy,
  seniorityAllowance: optionalNonNegativeNumber('Phu cap tham nien'),
  positionAllowance: optionalNonNegativeNumber('Phu cap chuc vu'),
  concurrentAllowance: optionalNonNegativeNumber('Phu cap kiem nhiem'),
  otherAllowance: optionalNonNegativeNumber('Phu cap khac'),
});

type SalaryRecordFormValues = z.infer<typeof salaryRecordFormSchema>;

const DEFAULT_FORM_VALUES: SalaryRecordFormValues = {
  civilServantRankId: '',
  rankStepId: '',
  decisionNo: '',
  currentLevelDate: getToday(),
  effectiveFrom: getToday(),
  percentEnjoy: 100,
  seniorityAllowance: undefined,
  positionAllowance: undefined,
  concurrentAllowance: undefined,
  otherAllowance: undefined,
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function formatCoefficient(value: number): string {
  return value.toFixed(2);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || value === 0) return '-';
  return value.toLocaleString('vi-VN');
}

function groupRanksByCategory(
  ranks: CivilServantRank[],
): { category: string; label: string; items: CivilServantRank[] }[] {
  const groups = new Map<string, CivilServantRank[]>();

  for (const rank of ranks) {
    const category = rank.category ?? 'KHAC';
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)?.push(rank);
  }

  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    label: RANK_CATEGORY_LABELS[category] ?? category,
    items: items.sort((a, b) => a.code.localeCompare(b.code)),
  }));
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function isRankSector(value: string): value is RankSector {
  return (RANK_SECTOR_ORDER as readonly string[]).includes(value);
}

export function SalaryTab({ employeeId, canWrite }: SalaryTabProps) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [rankSearch, setRankSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState<RankSectorFilter>('ALL');
  const debouncedRankSearch = useDebounce(rankSearch, 300);

  const form = useForm<SalaryRecordFormValues>({
    resolver: zodResolver(salaryRecordFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const selectedRankId = form.watch('civilServantRankId');
  const selectedStepId = form.watch('rankStepId');

  const {
    data: records = [],
    isLoading: isLoadingRecords,
    error: recordsError,
  } = useQuery({
    queryKey: ['salary-records', employeeId],
    queryFn: () => salaryService.getRecords(employeeId),
  });

  const {
    data: sectorOptionsResponse = [],
    error: sectorOptionsError,
  } = useQuery({
    queryKey: ['civil-servant-rank-sectors'],
    queryFn: () => salaryService.getSectors(),
    enabled: canWrite && isFormOpen,
  });

  const {
    data: allRanks = [],
    isFetching: isFetchingRanks,
    error: ranksError,
  } = useQuery({
    queryKey: [
      'civil-servant-ranks',
      {
        sectorGroup: sectorFilter === 'ALL' ? undefined : sectorFilter,
        search: debouncedRankSearch || undefined,
        active: showDeprecated ? undefined : 'true',
      },
    ],
    queryFn: () =>
      salaryService.getRanks({
        sectorGroup: sectorFilter === 'ALL' ? undefined : sectorFilter,
        search: debouncedRankSearch || undefined,
        active: showDeprecated ? undefined : 'true',
      }),
    enabled: canWrite && isFormOpen,
  });

  const sectorFilterOptions = useMemo(() => {
    const responseSectors = sectorOptionsResponse.filter(isRankSector);
    const orderedSectors =
      responseSectors.length > 0
        ? RANK_SECTOR_ORDER.filter((sector) =>
            responseSectors.includes(sector),
          )
        : [...RANK_SECTOR_ORDER];

    return [
      { value: 'ALL' as RankSectorFilter, label: 'Tat ca nhom' },
      ...orderedSectors.map((sector) => ({
        value: sector as RankSectorFilter,
        label: RANK_SECTOR_LABELS[sector],
      })),
    ];
  }, [sectorOptionsResponse]);

  const currentRecord = useMemo(
    () => records.find((record) => record.effectiveTo === null),
    [records],
  );

  const groupedRanks = useMemo(() => groupRanksByCategory(allRanks), [allRanks]);

  const selectedRank = useMemo(
    () => allRanks.find((rank) => rank.id === selectedRankId) ?? null,
    [allRanks, selectedRankId],
  );

  const selectedRankGroup = selectedRank?.rankGroup ?? null;

  const {
    data: rankSteps = [],
    isFetching: isFetchingSteps,
    error: rankStepsError,
  } = useQuery({
    queryKey: ['salary-scale-steps', selectedRankGroup],
    queryFn: () => {
      if (!selectedRankGroup) {
        return Promise.resolve([]);
      }
      return salaryService.getRankSteps(selectedRankGroup);
    },
    enabled: canWrite && isFormOpen && Boolean(selectedRankGroup),
  });

  const visibleSteps = useMemo(() => {
    if (showDeprecated) {
      return rankSteps;
    }
    return rankSteps.filter((step) => step.isActive);
  }, [rankSteps, showDeprecated]);

  const selectedStep = useMemo(
    () => rankSteps.find((step) => step.id === selectedStepId) ?? null,
    [rankSteps, selectedStepId],
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateSalaryRecordPayload) =>
      salaryService.createRecord(employeeId, payload),
    onSuccess: () => {
      toast.success('Da tao quyet dinh luong moi');
      setIsFormOpen(false);
      form.reset(DEFAULT_FORM_VALUES);
      form.clearErrors();
      void queryClient.invalidateQueries({
        queryKey: ['salary-records', employeeId],
      });
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Khong the tao quyet dinh luong');
      form.setError('root.serverError', {
        type: 'server',
        message,
      });
      toast.error(message);
    },
  });

  const handleCreateRecord = useCallback(
    (values: SalaryRecordFormValues) => {
      form.clearErrors('root.serverError');

      if (!selectedStep) {
        form.setError('rankStepId', {
          type: 'manual',
          message: 'Khong xac dinh duoc bac luong da chon',
        });
        return;
      }

      if (!selectedStep.isActive) {
        form.setError('rankStepId', {
          type: 'manual',
          message: 'Bac luong da het hieu luc, vui long chon bac con hieu luc',
        });
        return;
      }

      const payload: CreateSalaryRecordPayload = {
        civilServantRankId: values.civilServantRankId,
        salaryLevel: selectedStep.level,
        currentLevelDate: values.currentLevelDate,
        effectiveFrom: values.effectiveFrom,
        decisionNo: values.decisionNo?.trim() || undefined,
        percentEnjoy: values.percentEnjoy,
        seniorityAllowance: values.seniorityAllowance,
        positionAllowance: values.positionAllowance,
        concurrentAllowance: values.concurrentAllowance,
        otherAllowance: values.otherAllowance,
      };

      createMutation.mutate(payload);
    },
    [createMutation, form, selectedStep],
  );

  useEffect(() => {
    if (!isFormOpen) {
      return;
    }

    form.reset(DEFAULT_FORM_VALUES);
    form.clearErrors();
    setRankSearch('');
    setShowDeprecated(false);
    setSectorFilter('ALL');
  }, [form, isFormOpen]);

  useEffect(() => {
    if (!isFormOpen) {
      return;
    }

    if (!allRanks.length) {
      if (selectedRankId) {
        form.setValue('civilServantRankId', '', {
          shouldDirty: false,
          shouldValidate: true,
        });
      }
      if (selectedStepId) {
        form.setValue('rankStepId', '', {
          shouldDirty: false,
          shouldValidate: true,
        });
      }
      return;
    }

    const isSelectedRankVisible = allRanks.some((rank) => rank.id === selectedRankId);
    if (isSelectedRankVisible) {
      return;
    }

    const fallbackRank = allRanks.find((rank) => rank.isActive) ?? allRanks[0];
    if (!fallbackRank) {
      return;
    }

    form.setValue('civilServantRankId', fallbackRank.id, {
      shouldDirty: false,
      shouldValidate: true,
    });
    form.setValue('rankStepId', '', {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [allRanks, form, isFormOpen, selectedRankId, selectedStepId]);

  useEffect(() => {
    if (!isFormOpen) {
      return;
    }

    if (!selectedRankId) {
      if (selectedStepId) {
        form.setValue('rankStepId', '', {
          shouldDirty: false,
          shouldValidate: true,
        });
      }
      return;
    }

    if (!visibleSteps.length) {
      if (selectedStepId) {
        form.setValue('rankStepId', '', {
          shouldDirty: false,
          shouldValidate: true,
        });
      }
      return;
    }

    const isSelectedStepVisible = visibleSteps.some((step) => step.id === selectedStepId);
    if (isSelectedStepVisible) {
      return;
    }

    const fallbackStep = visibleSteps.find((step) => step.isActive) ?? visibleSteps[0];
    if (!fallbackStep) {
      return;
    }

    form.setValue('rankStepId', fallbackStep.id, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [form, isFormOpen, selectedRankId, selectedStepId, visibleSteps]);

  useEffect(() => {
    if (!isFormOpen) {
      return;
    }

    const hasSelectedOption = sectorFilterOptions.some(
      (option) => option.value === sectorFilter,
    );
    if (!hasSelectedOption) {
      setSectorFilter('ALL');
    }
  }, [isFormOpen, sectorFilter, sectorFilterOptions]);

  useEffect(() => {
    if (ranksError && isFormOpen) {
      toast.error(getErrorMessage(ranksError, 'Khong the tai danh muc ngach.'));
    }
  }, [isFormOpen, ranksError]);

  useEffect(() => {
    if (sectorOptionsError && isFormOpen) {
      toast.error(
        getErrorMessage(
          sectorOptionsError,
          'Khong the tai danh muc nhom ngach.',
        ),
      );
    }
  }, [isFormOpen, sectorOptionsError]);

  useEffect(() => {
    if (rankStepsError && isFormOpen) {
      toast.error(getErrorMessage(rankStepsError, 'Khong the tai danh sach bac.'));
    }
  }, [isFormOpen, rankStepsError]);

  const rankStepPlaceholder = !selectedRankId
    ? 'Chon ngach/chuc danh truoc'
    : isFetchingSteps
      ? 'Dang tai bac...'
      : 'Chon bac luong';

  return (
    <div className="space-y-6">
      {currentRecord ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Luong hien tai</CardTitle>
              <Badge variant="default">Dang ap dung</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <span className="text-sm text-muted-foreground">Ngach</span>
                <p className="font-medium">
                  {currentRecord.civilServantRank?.code ?? '-'}{' '}
                  <span className="text-sm text-muted-foreground">
                    {currentRecord.civilServantRank?.name}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Bac / He so</span>
                <p className="font-medium">
                  Bac {currentRecord.salaryLevel} /{' '}
                  {formatCoefficient(currentRecord.coefficient)}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">% Huong</span>
                <p className="font-medium">{currentRecord.percentEnjoy}%</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Du kien nang bac</span>
                <p className="font-medium">{formatDate(currentRecord.expectedRaiseDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lich su luong</CardTitle>
              <CardDescription>Qua trinh dien bien luong va phu cap</CardDescription>
            </div>
            {canWrite ? (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Them QD luong
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingRecords ? (
            <div className="py-8 text-center text-muted-foreground">Dang tai du lieu...</div>
          ) : recordsError ? (
            <div className="py-8 text-center text-destructive">
              {getErrorMessage(recordsError, 'Khong the tai du lieu luong')}
            </div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Chua co quyet dinh luong nao
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngach/Chuc danh</TableHead>
                    <TableHead className="text-center">Bac</TableHead>
                    <TableHead className="text-center">He so</TableHead>
                    <TableHead className="text-center">% Huong</TableHead>
                    <TableHead>QD luong</TableHead>
                    <TableHead>Ngay huong bac</TableHead>
                    <TableHead>Hieu luc</TableHead>
                    <TableHead>Phu cap TN</TableHead>
                    <TableHead>Phu cap CV</TableHead>
                    <TableHead>Nang bac du kien</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <SalaryRecordRow key={record.id} record={record} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Them Quyet dinh luong</DialogTitle>
            <DialogDescription>
              Chon ngach va bac. He so duoc tu dong lay tu cau hinh bac luong.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateRecord)} className="grid gap-4 py-4">
              {form.formState.errors.root?.serverError?.message ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {form.formState.errors.root.serverError.message}
                </div>
              ) : null}

              <FormField
                control={form.control}
                name="civilServantRankId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Ngach/chuc danh vien chuc <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="space-y-2">
                      <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
                        <Select
                          value={sectorFilter}
                          onValueChange={(value) => setSectorFilter(value as RankSectorFilter)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Nhom ngach/chuc danh" />
                          </SelectTrigger>
                          <SelectContent>
                            {sectorFilterOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          placeholder="Tim ma ngach hoac ten..."
                          value={rankSearch}
                          onChange={(event) => setRankSearch(event.target.value)}
                        />

                        <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={showDeprecated}
                            onChange={(event) => setShowDeprecated(event.target.checked)}
                            className="rounded"
                          />
                          Hien ma cu
                        </label>
                      </div>

                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('rankStepId', '', {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        disabled={isFetchingRanks}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isFetchingRanks
                                  ? 'Dang tai ngach/chuc danh...'
                                  : 'Chon ngach/chuc danh'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-64">
                          {groupedRanks.map((group) => (
                            <SelectGroup key={group.category}>
                              <SelectLabel>{group.label}</SelectLabel>
                              {group.items.map((rank) => (
                                <SelectItem
                                  key={rank.id}
                                  value={rank.id}
                                  disabled={!rank.isActive}
                                >
                                  {!rank.isActive ? '[Het hieu luc] ' : ''}
                                  {rank.code} - {rank.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                          {groupedRanks.length === 0 ? (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                              Khong tim thay ngach nao
                            </div>
                          ) : null}
                        </SelectContent>
                      </Select>

                      {selectedRank ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Info className="h-3.5 w-3.5" />
                          <span>
                            Nhom {selectedRank.rankGroup} · He so tu {selectedRank.minCoefficient}{' '}
                            den {selectedRank.maxCoefficient}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="rankStepId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Bac luong <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!selectedRankId || isFetchingSteps || visibleSteps.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={rankStepPlaceholder} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {visibleSteps.map((step) => (
                            <SelectItem
                              key={step.id}
                              value={step.id}
                              disabled={!step.isActive}
                            >
                              {!step.isActive ? '[Het hieu luc] ' : ''}
                              Bac {step.level} - He so {formatCoefficient(step.coefficient)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>He so luong</FormLabel>
                  <FormControl>
                    <Input
                      value={selectedStep ? formatCoefficient(selectedStep.coefficient) : ''}
                      placeholder="Tu dong theo bac luong"
                      readOnly
                      className="bg-muted"
                    />
                  </FormControl>
                  <FormDescription>
                    Tinh toan tu dong theo nhom va bac luong da chon
                  </FormDescription>
                </FormItem>
              </div>

              <FormField
                control={form.control}
                name="decisionNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>So QD luong</FormLabel>
                    <FormControl>
                      <Input
                        id="salary-decision-no"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="VD: 123/QD-SGU"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="currentLevelDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Ngay huong bac hien tai <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Ngay hieu luc QD <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="percentEnjoy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Huong</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        placeholder="100"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="seniorityAllowance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phu cap tham nien</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value ?? ''}
                          onChange={(event) => field.onChange(event.target.value)}
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="positionAllowance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phu cap chuc vu</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value ?? ''}
                          onChange={(event) => field.onChange(event.target.value)}
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="concurrentAllowance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phu cap kiem nhiem</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value ?? ''}
                          onChange={(event) => field.onChange(event.target.value)}
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="otherAllowance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phu cap khac</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value ?? ''}
                          onChange={(event) => field.onChange(event.target.value)}
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Huy
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Dang luu...' : 'Tao QD luong'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SalaryRecordRow({ record }: { record: SalaryRecord }) {
  const isCurrent = record.effectiveTo === null;
  const isDeprecatedRank = record.civilServantRank?.isActive === false;

  return (
    <TableRow className={isCurrent ? 'bg-primary/5 font-medium' : ''}>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {isDeprecatedRank ? (
            <span title="Ma ngach da het hieu luc">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            </span>
          ) : null}
          <span>{record.civilServantRank?.code ?? '-'}</span>
          <span className="text-sm text-muted-foreground">
            {record.civilServantRank?.name}
          </span>
          {isCurrent ? (
            <Badge variant="outline" className="ml-1 text-xs">
              Hien tai
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-center">{record.salaryLevel}</TableCell>
      <TableCell className="text-center">
        {formatCoefficient(record.coefficient)}
      </TableCell>
      <TableCell className="text-center">{record.percentEnjoy}%</TableCell>
      <TableCell>{record.decisionNo || '-'}</TableCell>
      <TableCell>{formatDate(record.currentLevelDate)}</TableCell>
      <TableCell>
        <span>{formatDate(record.effectiveFrom)}</span>
        {record.effectiveTo ? (
          <span className="text-muted-foreground">
            {' -> '}
            {formatDate(record.effectiveTo)}
          </span>
        ) : null}
      </TableCell>
      <TableCell>{formatCurrency(record.seniorityAllowance)}</TableCell>
      <TableCell>{formatCurrency(record.positionAllowance)}</TableCell>
      <TableCell>{formatDate(record.expectedRaiseDate)}</TableCell>
    </TableRow>
  );
}
