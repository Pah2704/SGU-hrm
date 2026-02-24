'use client';

import Link from 'next/link';
import { isAxiosError } from 'axios';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { recruitmentService } from '@/services/recruitment.service';
import type { CreateCandidatePayload } from '@/types/recruitment';

type ApplyFormState = {
  fullName: string;
  email: string;
  phone: string;
  citizenId: string;
  dob: string;
  gender: '' | 'NAM' | 'NU';
  currentAddress: string;
  cvFileUrl: string;
};

const EMPTY_FORM: ApplyFormState = {
  fullName: '',
  email: '',
  phone: '',
  citizenId: '',
  dob: '',
  gender: '',
  currentAddress: '',
  cvFileUrl: '',
};

export default function PublicApplyPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params?.campaignId;

  const [formState, setFormState] = useState<ApplyFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: campaigns } = useSWR('public-recruitment-campaigns', () =>
    recruitmentService.listPublicCampaigns(),
  );

  const selectedCampaign = useMemo(
    () => campaigns?.find((item) => item.id === campaignId),
    [campaignId, campaigns],
  );

  const onSubmit = async () => {
    if (!campaignId) {
      return;
    }
    if (!formState.fullName.trim() || !formState.email.trim()) {
      setErrorMessage('Họ tên và email là bắt buộc.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmittedMessage(null);
    try {
      const payload: CreateCandidatePayload = {
        fullName: formState.fullName.trim(),
        email: formState.email.trim(),
        phone: formState.phone.trim() || undefined,
        citizenId: formState.citizenId.trim() || undefined,
        dob: formState.dob
          ? new Date(`${formState.dob}T00:00:00`).toISOString()
          : undefined,
        gender: formState.gender || undefined,
        currentAddress: formState.currentAddress.trim() || undefined,
        cvFileUrl: formState.cvFileUrl.trim() || undefined,
      };

      await recruitmentService.applyPublic(campaignId, payload);
      setSubmittedMessage(
        'Đã nộp hồ sơ thành công. Phòng Tổ chức - Cán bộ sẽ liên hệ với bạn nếu hồ sơ phù hợp.',
      );
      setFormState(EMPTY_FORM);
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        setErrorMessage(
          error.response?.data?.message || 'Không thể gửi hồ sơ. Vui lòng thử lại.',
        );
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Không thể gửi hồ sơ. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <Button variant="ghost" asChild className="pl-0">
          <Link href="/public/recruitment">Quay lại danh sách tuyển dụng</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Đơn ứng tuyển</h1>
        <p className="text-sm text-muted-foreground">
          {selectedCampaign
            ? `Đợt tuyển dụng: ${selectedCampaign.title}`
            : 'Vui lòng điền thông tin ứng viên.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin ứng viên</CardTitle>
          <CardDescription>
            Bạn cần điền ít nhất họ tên và email để nộp hồ sơ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          {submittedMessage ? (
            <div className="rounded-md border border-[var(--status-approved)]/30 bg-[var(--status-approved)]/10 p-3 text-sm text-[var(--status-approved)]">
              {submittedMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apply-full-name">Họ và tên *</Label>
              <Input
                id="apply-full-name"
                value={formState.fullName}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, fullName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apply-email">Email *</Label>
              <Input
                id="apply-email"
                type="email"
                value={formState.email}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apply-phone">Số điện thoại</Label>
              <Input
                id="apply-phone"
                value={formState.phone}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apply-citizen">CCCD</Label>
              <Input
                id="apply-citizen"
                value={formState.citizenId}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, citizenId: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="apply-dob">Ngày sinh</Label>
              <Input
                id="apply-dob"
                type="date"
                value={formState.dob}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, dob: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apply-gender">Giới tính</Label>
              <select
                id="apply-gender"
                value={formState.gender}
                onChange={(event) =>
                  setFormState((prev) => ({
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
              <Label htmlFor="apply-cv-url">CV URL</Label>
              <Input
                id="apply-cv-url"
                value={formState.cvFileUrl}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, cvFileUrl: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apply-address">Địa chỉ hiện tại</Label>
            <Input
              id="apply-address"
              value={formState.currentAddress}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  currentAddress: event.target.value,
                }))
              }
            />
          </div>

          <Button onClick={onSubmit} disabled={isSubmitting || !campaignId}>
            {isSubmitting ? 'Đang gửi...' : 'Gửi hồ sơ'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
