'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import useSWR from 'swr';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import {
  canAccessPath,
  getAuthSnapshot,
  hasAnyPermission,
} from '@/lib/authz';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Profile = {
  email?: string;
  employee?: {
    id?: string;
    employeeCode?: string;
    fullName?: string;
    unit?: {
      name?: string;
    };
  };
};

const EMPLOYEE_READ_PERMISSIONS = [
  'employees:read',
  'employees:read_unit',
  'employees:read_own',
];

const LEAVE_READ_PERMISSIONS = [
  'leaves:read',
  'leaves:read_unit',
  'leaves:read_own',
];

const RECRUITMENT_READ_PERMISSIONS = ['recruitment:read'];

const fetchProfile = () => api.get<Profile>('/users/me').then((res) => res.data);

export default function OverviewPage() {
  const authSnapshot = useMemo(() => getAuthSnapshot(), []);
  const canReadEmployees = hasAnyPermission(
    authSnapshot.permissions,
    EMPLOYEE_READ_PERMISSIONS,
  );
  const canReadLeaves = hasAnyPermission(
    authSnapshot.permissions,
    LEAVE_READ_PERMISSIONS,
  );
  const canReadRecruitment = hasAnyPermission(
    authSnapshot.permissions,
    RECRUITMENT_READ_PERMISSIONS,
  );

  const canAccessOrganizations = canAccessPath('/organizations', authSnapshot);
  const canAccessEmployees = canAccessPath('/employees', authSnapshot);
  const canAccessLeavesManagement = canAccessPath('/leaves/manage', authSnapshot);
  const canAccessRecruitment = canAccessPath('/recruitment/manage', authSnapshot);

  const { data: profile } = useSWR('overview-profile', fetchProfile);
  const { data: employeeSummary } = useSWR(
    canReadEmployees ? ['overview-employees-count'] : null,
    () =>
      api
        .get<{ total: number }>('/employees', { params: { page: 1, limit: 1 } })
        .then((res) => res.data),
  );
  const { data: leaveSummary } = useSWR(
    canReadLeaves
      ? ['overview-leaves-count']
      : null,
    () =>
      api
        .get<{ meta?: { total?: number } }>('/leave-requests', {
          params: { page: 1, limit: 1 },
        })
        .then((res) => res.data),
  );
  const { data: recruitmentSummary } = useSWR(
    canReadRecruitment ? ['overview-recruitment-count'] : null,
    () =>
      api
        .get<{ meta?: { total?: number } }>('/recruitment/campaigns', {
          params: { page: 1, limit: 1 },
        })
        .then((res) => res.data),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Tong quan nhan su
        </h1>
        <p className="text-sm text-muted-foreground">
          Xin chao {profile?.employee?.fullName ?? profile?.email ?? 'nguoi dung'}.
          Day la trang tong quan sau khi dang nhap.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Nhan su
            </CardTitle>
            <CardDescription>
              Tong so nhan su trong pham vi quyen cua ban.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{employeeSummary?.total ?? '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              Nghi phep
            </CardTitle>
            <CardDescription>So don nghi phep co the xem trong he thong.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {leaveSummary?.meta?.total ?? '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BriefcaseBusiness className="h-4 w-4" />
              Tuyen dung
            </CardTitle>
            <CardDescription>So chien dich tuyen dung co the truy cap.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {recruitmentSummary?.meta?.total ?? '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutDashboard className="h-4 w-4" />
            Dieu huong nhanh
          </CardTitle>
          <CardDescription>
            Cac chuc nang nay da duoc loc theo quyen cua tai khoan hien tai.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canAccessOrganizations ? (
            <Button asChild variant="outline">
              <Link href="/organizations">
                To chuc <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          {canAccessEmployees ? (
            <Button asChild variant="outline">
              <Link href="/employees">
                Nhan su <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          {canAccessLeavesManagement ? (
            <Button asChild variant="outline">
              <Link href="/leaves/manage">
                Quan ly nghi phep <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          {canAccessRecruitment ? (
            <Button asChild variant="outline">
              <Link href="/recruitment/manage">
                Tuyen dung <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
