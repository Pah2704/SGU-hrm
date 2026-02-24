'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { recruitmentService } from '@/services/recruitment.service';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function PublicRecruitmentListPage() {
  const { data, error, isLoading } = useSWR(
    'public-recruitment-campaigns',
    () => recruitmentService.listPublicCampaigns(),
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tuyển dụng SGU</h1>
        <p className="text-sm text-muted-foreground">
          Danh sách các đợt tuyển dụng đang mở của Trường Đại học Sài Gòn.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Không thể tải danh sách tuyển dụng.
        </div>
      ) : null}

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.length ? (
            data.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <CardTitle>{campaign.title}</CardTitle>
                  <CardDescription>
                    Đơn vị: {campaign.unit?.name ?? '-'} | Vị trí:{' '}
                    {campaign.position?.name ?? '-'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {campaign.description || 'Chưa có mô tả chi tiết.'}
                  </p>
                  <div className="text-sm">
                    <span className="font-medium">Số lượng:</span> {campaign.quantity}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Hạn nộp:</span>{' '}
                    {new Date(campaign.deadline).toLocaleDateString('vi-VN')}
                  </div>
                  <Button asChild className="w-full">
                    <Link href={`/public/recruitment/${campaign.id}/apply`}>
                      Nộp hồ sơ
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground md:col-span-2">
              Hiện tại không có đợt tuyển dụng đang mở.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
