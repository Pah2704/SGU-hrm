'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import useSWR from 'swr';
import api from '@/lib/api';
import { isAxiosError } from 'axios';

const decisionSchema = z.object({
  positionId: z.string().min(1, 'Vui lòng chọn chức vụ'),
  decisionNo: z.string().optional(),
  decisionDate: z.string().optional(),
  appointDate: z.string().min(1, 'Vui lòng chọn ngày hiệu lực'),
  endDate: z.string().optional(),
  isPrimary: z.boolean().default(false),
  documentUrl: z.string().optional(),
});

type DecisionFormValues = z.infer<typeof decisionSchema>;

interface PositionOption {
  id: string;
  code: string;
  name: string;
}

export interface DecisionRecord {
  id: string;
  positionId: string;
  decisionNo?: string | null;
  decisionDate?: string | null;
  appointDate: string;
  endDate?: string | null;
  isPrimary: boolean;
  documentUrl?: string | null;
  position?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export type DecisionFormMode = 'process' | 'appointment';

interface DecisionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  decision?: DecisionRecord;
  onSuccess: () => void;
  mode?: DecisionFormMode;
}

const COPY_BY_MODE: Record<
  DecisionFormMode,
  {
    createTitle: string;
    updateTitle: string;
    description: string;
    createSuccess: string;
    updateSuccess: string;
    saveButtonLabel: string;
    appointDateLabel: string;
    endDateLabel: string;
  }
> = {
  process: {
    createTitle: 'Thêm quá trình công tác',
    updateTitle: 'Cập nhật quá trình công tác',
    description: 'Nhập thông tin quá trình công tác của nhân sự.',
    createSuccess: 'Đã thêm quá trình công tác thành công',
    updateSuccess: 'Đã cập nhật quá trình công tác thành công',
    saveButtonLabel: 'Lưu quá trình công tác',
    appointDateLabel: 'Ngày bắt đầu công tác (Hiệu lực)',
    endDateLabel: 'Ngày kết thúc quá trình công tác',
  },
  appointment: {
    createTitle: 'Bổ nhiệm / Điều động',
    updateTitle: 'Cập nhật quyết định bổ nhiệm / điều động',
    description: 'Nhập thông tin quyết định bổ nhiệm hoặc điều động nhân sự.',
    createSuccess: 'Đã tạo quyết định bổ nhiệm / điều động thành công',
    updateSuccess: 'Đã cập nhật quyết định bổ nhiệm / điều động thành công',
    saveButtonLabel: 'Lưu quyết định',
    appointDateLabel: 'Ngày bổ nhiệm / điều động (Hiệu lực)',
    endDateLabel: 'Ngày kết thúc (Thôi giữ chức vụ)',
  },
};

export function DecisionFormModal({
  open,
  onOpenChange,
  employeeId,
  decision,
  onSuccess,
  mode = 'appointment',
}: DecisionFormModalProps) {
  const copy = useMemo(() => COPY_BY_MODE[mode], [mode]);
  const form = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: {
      positionId: '',
      decisionNo: '',
      decisionDate: '',
      appointDate: '',
      isPrimary: false,
      documentUrl: '',
    },
  });

  const { data: positions } = useSWR<PositionOption[]>(
    '/positions',
    (url: string) => api.get(url).then((res) => res.data),
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      positionId: decision?.positionId || '',
      decisionNo: decision?.decisionNo || '',
      decisionDate: decision?.decisionDate
        ? new Date(decision.decisionDate).toISOString().split('T')[0]
        : '',
      appointDate: decision?.appointDate
        ? new Date(decision.appointDate).toISOString().split('T')[0]
        : '',
      endDate: decision?.endDate
        ? new Date(decision.endDate).toISOString().split('T')[0]
        : '',
      isPrimary: decision?.isPrimary || false,
      documentUrl: decision?.documentUrl || '',
    });
  }, [open, decision, form]);

  const onSubmit = async (data: DecisionFormValues) => {
    try {
      const payload = {
        ...data,
        employeeId,
        appointDate: new Date(data.appointDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
        decisionDate: data.decisionDate
          ? new Date(data.decisionDate).toISOString()
          : undefined,
      };

      if (decision) {
        await api.patch(`/decisions/${decision.id}`, payload);
        toast.success(copy.updateSuccess);
      } else {
        await api.post('/decisions', payload);
        toast.success(copy.createSuccess);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error('Không thể lưu quyết định', {
        description: isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message || error.message
          : error instanceof Error
            ? error.message
            : 'Vui lòng thử lại.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {decision ? copy.updateTitle : copy.createTitle}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="positionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chức vụ</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn chức vụ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {positions?.map((position) => (
                          <SelectItem key={position.id} value={position.id}>
                            {position.name} ({position.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="appointDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{copy.appointDateLabel}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="decisionNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số quyết định</FormLabel>
                    <FormControl>
                      <Input placeholder="123/QD-DHSG" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="decisionDate"
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
            </div>

            <FormField
              control={form.control}
              name="documentUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link văn bản (URL)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Giai đoạn sau có thể thay bằng upload file trực tiếp.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPrimary"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Là chức vụ chính (Primary)</FormLabel>
                    <FormDescription>
                      Nếu chọn, hệ thống sẽ tự động đóng chức vụ chính cũ (nếu
                      có).
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {decision ? (
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{copy.endDateLabel}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Để trống nếu vẫn đang đương nhiệm.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button type="submit">{copy.saveButtonLabel}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

