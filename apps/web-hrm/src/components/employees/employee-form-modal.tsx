'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { isAxiosError } from 'axios';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { employeesService } from '@/services/employees.service';
import { Employee, Gender } from '@/types/employee';
import type { TreeUnitDto } from '@/types';
import api from '@/lib/api';

const employeeSchema = z.object({
  employeeCode: z.string().min(1, 'Mã viên chức là bắt buộc'),
  citizenId: z.string().min(9, 'CCCD phải có ít nhất 9 số'),
  fullName: z.string().min(1, 'Họ và tên là bắt buộc'),
  aliasName: z.string().optional(),
  dob: z.string().min(1, 'Ngày sinh là bắt buộc'),
  gender: z.nativeEnum(Gender),
  unitId: z.string().min(1, 'Đơn vị là bắt buộc'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  phone: z.string().optional(),
  citizenCardDate: z.string().optional(),
  citizenCardPlace: z.string().optional(),
  ethnicityId: z.string().optional(),
  religionId: z.string().optional(),
  initialRecruitmentDate: z.string().optional(),
  initialRecruitmentAgency: z.string().optional(),
  currentOrgJoinDate: z.string().optional(),
  officialDate: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeToEdit?: Employee | null;
  onSaved?: () => void;
}

type UnitOption = {
  id: string;
  label: string;
};

const toOptionalText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const toOptionalDate = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const getEmptyFormValues = (): EmployeeFormValues => ({
  employeeCode: '',
  citizenId: '',
  fullName: '',
  aliasName: '',
  dob: '',
  gender: Gender.MALE,
  unitId: '',
  email: '',
  phone: '',
  citizenCardDate: '',
  citizenCardPlace: '',
  ethnicityId: '',
  religionId: '',
  initialRecruitmentDate: '',
  initialRecruitmentAgency: '',
  currentOrgJoinDate: '',
  officialDate: '',
});

const flattenUnitTree = (units: TreeUnitDto[]): UnitOption[] => {
  const rootSgu = units.find((unit) => unit.code === 'SGU');
  const roots = rootSgu ? rootSgu.children : units;
  const options: UnitOption[] = [];

  const walk = (nodes: TreeUnitDto[], depth: number) => {
    const sortedNodes = [...nodes].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'),
    );

    for (const node of sortedNodes) {
      if (node.isDeleted) {
        continue;
      }

      const prefix = depth > 0 ? `${'  '.repeat(depth)}- ` : '';
      const statusSuffix = node.status === 'ACTIVE' ? '' : ` (${node.status})`;

      options.push({
        id: node.id,
        label: `${prefix}${node.name}${statusSuffix}`,
      });

      if (node.children?.length) {
        walk(node.children, depth + 1);
      }
    }
  };

  walk(roots, 0);

  return options;
};

const unitFetcher = async () =>
  api.get<TreeUnitDto[]>('/units').then((response) => response.data);

export function EmployeeFormModal({
  open,
  onOpenChange,
  employeeToEdit,
  onSaved,
}: EmployeeFormModalProps) {
  const isEditing = Boolean(employeeToEdit);
  const { data: unitTree = [], isLoading: isUnitsLoading } = useSWR(
    open ? '/units' : null,
    unitFetcher,
  );
  const unitOptions = useMemo(() => flattenUnitTree(unitTree), [unitTree]);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: getEmptyFormValues(),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!employeeToEdit) {
      form.reset(getEmptyFormValues());
      return;
    }

    form.reset({
      employeeCode: employeeToEdit.employeeCode,
      citizenId: employeeToEdit.citizenId,
      fullName: employeeToEdit.fullName,
      aliasName: employeeToEdit.aliasName || '',
      dob: employeeToEdit.dob
        ? new Date(employeeToEdit.dob).toISOString().split('T')[0]
        : '',
      gender: employeeToEdit.gender,
      unitId: employeeToEdit.unitId,
      email: employeeToEdit.email || '',
      phone: employeeToEdit.phone || '',
      citizenCardDate: employeeToEdit.citizenCardDate
        ? new Date(employeeToEdit.citizenCardDate).toISOString().split('T')[0]
        : '',
      citizenCardPlace: employeeToEdit.citizenCardPlace || '',
      ethnicityId: employeeToEdit.ethnicityId || '',
      religionId: employeeToEdit.religionId || '',
      initialRecruitmentDate: employeeToEdit.initialRecruitmentDate
        ? new Date(employeeToEdit.initialRecruitmentDate)
            .toISOString()
            .split('T')[0]
        : '',
      initialRecruitmentAgency: employeeToEdit.initialRecruitmentAgency || '',
      currentOrgJoinDate: employeeToEdit.currentOrgJoinDate
        ? new Date(employeeToEdit.currentOrgJoinDate).toISOString().split('T')[0]
        : '',
      officialDate: employeeToEdit.officialDate
        ? new Date(employeeToEdit.officialDate).toISOString().split('T')[0]
        : '',
    });
  }, [open, employeeToEdit, form]);

  const onSubmit = async (values: EmployeeFormValues) => {
    const payload = {
      ...values,
      aliasName: toOptionalText(values.aliasName),
      email: toOptionalText(values.email),
      phone: toOptionalText(values.phone),
      citizenCardDate: toOptionalDate(values.citizenCardDate),
      citizenCardPlace: toOptionalText(values.citizenCardPlace),
      ethnicityId: toOptionalText(values.ethnicityId),
      religionId: toOptionalText(values.religionId),
      initialRecruitmentDate: toOptionalDate(values.initialRecruitmentDate),
      initialRecruitmentAgency: toOptionalText(values.initialRecruitmentAgency),
      currentOrgJoinDate: toOptionalDate(values.currentOrgJoinDate),
      officialDate: toOptionalDate(values.officialDate),
    };

    if (!isEditing && !payload.email) {
      form.setError('email', {
        type: 'manual',
        message: 'Email là bắt buộc khi thêm mới nhân sự',
      });
      return;
    }

    try {
      if (isEditing && employeeToEdit) {
        await employeesService.update(employeeToEdit.id, payload);
        toast.success('Đã cập nhật hồ sơ nhân sự thành công');
      } else {
        await employeesService.create(payload);
        toast.success('Đã thêm mới nhân sự thành công');
      }

      onSaved?.();
      onOpenChange(false);
    } catch (error: unknown) {
      const description = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Vui lòng thử lại.';

      toast.error('Không thể lưu hồ sơ nhân sự', {
        description,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Cập nhật hồ sơ nhân sự' : 'Thêm mới nhân sự'}
          </DialogTitle>
          <DialogDescription>
            Form hồ sơ được tổ chức theo tab để đồng nhất với trang chi tiết nhân
            sự.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Thông tin chung</TabsTrigger>
                <TabsTrigger value="contact">Liên hệ & Đơn vị</TabsTrigger>
                <TabsTrigger value="recruitment">
                  Thông tin tuyển dụng
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employeeCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Mã viên chức <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="VD: VC001"
                            {...field}
                            disabled={isEditing}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="citizenId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          CCCD/CMND <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="079..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Họ và tên <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="NGUYEN VAN A" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="aliasName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tên gọi khác</FormLabel>
                        <FormControl>
                          <Input placeholder="Tên gọi khác (nếu có)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Ngày sinh <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Giới tính</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn giới tính" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={Gender.MALE}>Nam</SelectItem>
                            <SelectItem value={Gender.FEMALE}>Nữ</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="citizenCardDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày cấp CCCD/CMND</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="citizenCardPlace"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nơi cấp CCCD/CMND</FormLabel>
                        <FormControl>
                          <Input placeholder="Nơi cấp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ethnicityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dân tộc</FormLabel>
                        <FormControl>
                          <Input placeholder="ID dân tộc" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="religionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tôn giáo</FormLabel>
                        <FormControl>
                          <Input placeholder="ID tôn giáo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4">
                <FormField
                  control={form.control}
                  name="unitId"
                  render={({ field }) => {
                    const hasCurrentValue = unitOptions.some(
                      (unit) => unit.id === field.value,
                    );

                    return (
                      <FormItem>
                        <FormLabel>
                          Đơn vị quản lý <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isUnitsLoading || unitOptions.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  isUnitsLoading
                                    ? 'Đang tải cây đơn vị...'
                                    : 'Chọn đơn vị'
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {field.value && !hasCurrentValue ? (
                              <SelectItem value={field.value}>
                                Đơn vị hiện tại ({field.value})
                              </SelectItem>
                            ) : null}
                            {unitOptions.map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Email (Tạo tài khoản){' '}
                          {!isEditing ? (
                            <span className="text-destructive">*</span>
                          ) : null}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="example@sgu.edu.vn"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số điện thoại</FormLabel>
                        <FormControl>
                          <Input placeholder="090..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="recruitment" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="initialRecruitmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày tuyển dụng lần đầu</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="initialRecruitmentAgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cơ quan tuyển dụng</FormLabel>
                        <FormControl>
                          <Input placeholder="Cơ quan tuyển dụng" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currentOrgJoinDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày về cơ quan hiện tại</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="officialDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày vào biên chế chính thức</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="bg-brand-cyan hover:bg-brand-cyan/90"
              >
                {isEditing ? 'Lưu thay đổi' : 'Thêm mới'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
