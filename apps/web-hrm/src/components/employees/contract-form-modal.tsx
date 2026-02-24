
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { contractsService, Contract, ContractType, ContractStatus } from '@/services/contracts.service';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

const contractSchema = z.object({
  contractNumber: z.string().min(1, 'Số hợp đồng không được để trống'),
  contractType: z.nativeEnum(ContractType),
  startDate: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
  endDate: z.string().optional(),
  signedDate: z.string().optional(),
  status: z.nativeEnum(ContractStatus),
  notes: z.string().optional(),
});

type ContractFormValues = z.infer<typeof contractSchema>;

interface ContractFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  initialData?: Contract;
  onSuccess: () => void;
}

export function ContractFormModal({
  open,
  onOpenChange,
  employeeId,
  initialData,
  onSuccess,
}: ContractFormModalProps) {
  const isEditing = !!initialData;

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      contractNumber: '',
      contractType: ContractType.HDLD_XAC_DINH,
      startDate: '',
      endDate: '',
      signedDate: '',
      status: ContractStatus.ACTIVE,
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        contractNumber: initialData?.contractNumber || '',
        contractType: initialData?.contractType || ContractType.HDLD_XAC_DINH,
        startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
        endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '',
        signedDate: initialData?.signedDate ? new Date(initialData.signedDate).toISOString().split('T')[0] : '',
        status: initialData?.status || ContractStatus.ACTIVE,
        notes: initialData?.notes || '',
      });
    }
  }, [open, initialData, form]);

  const createMutation = useMutation({
    mutationFn: contractsService.create,
    onSuccess: () => {
      toast.success('Đã thêm hợp đồng thành công');
      onSuccess();
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Không thể thêm hợp đồng', {
        description: 'Vui lòng thử lại.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContractFormValues) => 
      contractsService.update(initialData!.id, data),
    onSuccess: () => {
      toast.success('Đã cập nhật hợp đồng thành công');
      onSuccess();
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Không thể cập nhật hợp đồng', {
        description: 'Vui lòng thử lại.',
      });
    },
  });

  const onSubmit = (values: ContractFormValues) => {
    const payload = {
      ...values,
      employeeId,
      // Handle empty strings for optional dates if needed, though Schema validation helps
      endDate: values.endDate || undefined,
      signedDate: values.signedDate || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Cập nhật hợp đồng' : 'Thêm hợp đồng mới'}</DialogTitle>
          <DialogDescription>
            Nhập thông tin hợp đồng lao động cho nhân sự.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contractNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số hợp đồng <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="VD: 123/HĐLĐ" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contractType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại hợp đồng <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn loại hợp đồng" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ContractType.HDLD_XAC_DINH}>HĐLĐ Xác định thời hạn</SelectItem>
                        <SelectItem value={ContractType.HDLD_KHONG_XAC_DINH}>HĐLĐ Không xác định thời hạn</SelectItem>
                        <SelectItem value={ContractType.THU_VIEC}>Thử việc</SelectItem>
                        <SelectItem value={ContractType.HDLV}>Hợp đồng làm việc</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="signedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày ký</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày hiệu lực <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày hết hạn</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trạng thái</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ContractStatus.DRAFT}>Dự thảo (Draft)</SelectItem>
                      <SelectItem value={ContractStatus.ACTIVE}>Hiệu lực (Active)</SelectItem>
                      <SelectItem value={ContractStatus.EXPIRED}>Hết hạn (Expired)</SelectItem>
                      <SelectItem value={ContractStatus.TERMINATED}>Chấm dứt (Terminated)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Ghi chú thêm về hợp đồng..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {isEditing ? 'Lưu thay đổi' : 'Tạo hợp đồng'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
