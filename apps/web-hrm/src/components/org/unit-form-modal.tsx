'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { isAxiosError } from 'axios';
import { TreeUnitDto, UnitType, UnitStatus } from '@/types';
import { Button } from '@/components/ui/button';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formSchema = z.object({
  code: z.string().min(1, 'Ma don vi la bat buoc'),
  name: z.string().min(1, 'Ten don vi la bat buoc'),
  shortName: z.string().optional(),
  unitType: z.nativeEnum(UnitType),
  status: z.nativeEnum(UnitStatus).optional(),
  parentId: z.string().optional(),
  sortOrder: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }

      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    },
    z.number().int().min(0, 'Thu tu phai lon hon hoac bang 0').optional(),
  ),
});

interface UnitFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: TreeUnitDto | null;
  parentId?: string | null;
  onSubmit: (data: z.infer<typeof formSchema>) => Promise<void>;
}

export function UnitFormModal({
  open,
  onOpenChange,
  initialData,
  parentId,
  onSubmit,
}: UnitFormModalProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      name: '',
      shortName: '',
      unitType: UnitType.PHONG,
      status: UnitStatus.ACTIVE,
      parentId: parentId || undefined,
      sortOrder: undefined,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        code: initialData.code,
        name: initialData.name,
        shortName: initialData.shortName || '',
        unitType: initialData.unitType as UnitType,
        status: initialData.status as UnitStatus,
        parentId: initialData.parentId || undefined,
        sortOrder: initialData.sortOrder,
      });
      return;
    }

    form.reset({
      code: '',
      name: '',
      shortName: '',
      unitType: UnitType.PHONG,
      status: UnitStatus.ACTIVE,
      parentId: parentId || undefined,
      sortOrder: undefined,
    });
  }, [initialData, parentId, form, open]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    form.clearErrors('code');

    try {
      await onSubmit(values);
      onOpenChange(false);
      form.reset();
    } catch (error: unknown) {
      if (
        isAxiosError<{ message?: string }>(error) &&
        error.response?.status === 409
      ) {
        form.setError('code', {
          type: 'server',
          message: 'Ma don vi da ton tai. Vui long dung ma khac.',
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Chinh sua don vi' : 'Them don vi moi'}</DialogTitle>
          <DialogDescription>
            {initialData
              ? 'Cap nhat thong tin don vi.'
              : 'Tao moi mot don vi trong he thong.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ma don vi</FormLabel>
                  <FormControl>
                    <Input placeholder="KHOA_CNTT" {...field} disabled={!!initialData} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ten don vi</FormLabel>
                  <FormControl>
                    <Input placeholder="Khoa Cong nghe thong tin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unitType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loai hinh</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chon loai" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(UnitType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thu tu</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        placeholder="De trong de tu sinh"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      De trong: he thong tu sinh theo buoc 10 trong cung cap don vi.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {initialData ? (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trang thai</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chon trang thai" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(UnitStatus).map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Dang luu...' : 'Luu thay doi'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
