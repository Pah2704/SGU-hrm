'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, CircleUser, IdCard, Mail, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

type UserProfile = {
  email?: string;
  roles?: Array<{
    name?: string;
    displayName?: string;
  }>;
  employee?: {
    id?: string;
    employeeCode?: string;
    fullName?: string;
    avatarUrl?: string;
    unit?: {
      id?: string;
      name?: string;
    };
  };
};

const fetchProfile = () =>
  api.get<UserProfile>('/users/me').then((response) => response.data);

export default function MyProfilePage() {
  const { data: profile, isLoading } = useSWR('my-profile-summary', fetchProfile);

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Dang tai ho so...</div>;
  }

  if (!profile?.employee?.id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ho so vien chuc</CardTitle>
          <CardDescription>
            Tai khoan hien tai chua duoc lien ket voi ho so nhan su.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const roleNames =
    profile.roles?.map((role) => role.displayName || role.name).filter(Boolean) ??
    [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Ho so vien chuc
        </h1>
        <p className="text-sm text-muted-foreground">
          Trang thong tin co ban cua ban. De cap nhat day du, vui long vao ly lich
          chi tiet.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Thong tin co ban</CardTitle>
            <CardDescription>
              Thong tin duoc dong bo theo ho so nhan su trong he thong.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href={`/employees/${profile.employee.id}`}>
              Sua ly lich chi tiet
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="flex items-center gap-4 md:col-span-1">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.employee.avatarUrl || undefined} />
              <AvatarFallback>
                {(profile.employee.fullName || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-base font-semibold">
                {profile.employee.fullName || 'Chua cap nhat'}
              </p>
              <p className="text-sm text-muted-foreground">
                {profile.employee.unit?.name || 'Chua cap nhat don vi'}
              </p>
            </div>
          </div>

          <div className="space-y-3 md:col-span-2">
            <div className="grid gap-1 rounded-md border p-3">
              <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <IdCard className="h-3.5 w-3.5" />
                Ma vien chuc
              </span>
              <span className="font-medium">
                {profile.employee.employeeCode || 'Chua cap nhat'}
              </span>
            </div>

            <div className="grid gap-1 rounded-md border p-3">
              <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Email tai khoan
              </span>
              <span className="font-medium">{profile.email || 'Chua cap nhat'}</span>
            </div>

            <div className="grid gap-2 rounded-md border p-3">
              <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Vai tro
              </span>
              <div className="flex flex-wrap gap-2">
                {roleNames.length ? (
                  roleNames.map((roleName) => (
                    <Badge key={roleName} variant="secondary">
                      {roleName}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">Khong xac dinh</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleUser className="h-4 w-4" />
            Ghi chu
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Du lieu tren day la tom tat. Nhan vao nut &quot;Sua ly lich chi tiet&quot; de vao
          trang ho so day du (hop dong, dao tao, qua trinh cong tac, ...).
        </CardContent>
      </Card>
    </div>
  );
}
