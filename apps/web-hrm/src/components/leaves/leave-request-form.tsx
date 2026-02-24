'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LeaveType } from '@/types/leaves';

export type LeaveRequestFormState = {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason: string;
};

interface LeaveRequestFormProps {
  leaveTypes: LeaveType[];
  value: LeaveRequestFormState;
  onChange: (next: LeaveRequestFormState) => void;
}

export function LeaveRequestForm({
  leaveTypes,
  value,
  onChange,
}: LeaveRequestFormProps) {
  return (
    <div className="grid gap-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="leave-type">Loại nghỉ</Label>
        <select
          id="leave-type"
          value={value.leaveTypeId}
          onChange={(event) =>
            onChange({
              ...value,
              leaveTypeId: event.target.value,
            })
          }
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {leaveTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from-date">Từ ngày</Label>
          <Input
            id="from-date"
            type="date"
            value={value.fromDate}
            onChange={(event) =>
              onChange({
                ...value,
                fromDate: event.target.value,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to-date">Đến ngày</Label>
          <Input
            id="to-date"
            type="date"
            value={value.toDate}
            onChange={(event) =>
              onChange({
                ...value,
                toDate: event.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="leave-reason">Lý do</Label>
        <Textarea
          id="leave-reason"
          value={value.reason}
          onChange={(event) =>
            onChange({
              ...value,
              reason: event.target.value,
            })
          }
          placeholder="Nhập lý do nghỉ phép..."
        />
      </div>
    </div>
  );
}
