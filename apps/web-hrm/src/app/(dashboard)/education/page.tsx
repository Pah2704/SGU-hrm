'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { getAuthSnapshot, hasAnyPermission } from '@/lib/authz';
import { EducationTab } from '@/components/employees/education-tab';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type ProfileResponse = {
  employee?: {
    id?: string;
    fullName?: string;
    employeeCode?: string;
  };
};

const fetchProfile = () =>
  api.get<ProfileResponse>('/users/me').then((response) => response.data);

export default function EducationSelfPage() {
  const authSnapshot = useMemo(() => getAuthSnapshot(), []);
  const canWrite = hasAnyPermission(authSnapshot.permissions, ['education:write']);
  const canApprove = hasAnyPermission(authSnapshot.permissions, ['education:approve']);

  const {
    data: profile,
    error,
    isLoading,
    mutate,
  } = useSWR('education-self-profile', fetchProfile);

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Dang tai du lieu dao tao...</div>;
  }

  if (error || !profile?.employee?.id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dao tao va boi duong</CardTitle>
          <CardDescription>
            Tai khoan hien tai chua lien ket duoc voi ho so nhan su.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dao tao va boi duong
          </h1>
          <p className="text-sm text-muted-foreground">
            Cap nhat van bang, chung chi va theo doi trang thai phe duyet.
          </p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tai lai
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thong tin nhan su</CardTitle>
          <CardDescription>
            {profile.employee.fullName ?? '-'} ({profile.employee.employeeCode ?? '-'})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EducationTab
            employeeId={profile.employee.id}
            canWrite={canWrite}
            canApprove={canApprove}
          />
        </CardContent>
      </Card>
    </div>
  );
}
