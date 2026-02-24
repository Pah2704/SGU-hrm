'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Eye, Plus, RefreshCw } from 'lucide-react';
import { employeesService } from '@/services/employees.service';
import { EmployeeStatus, type Employee } from '@/types/employee';
import { EmployeeFormModal } from '@/components/employees/employee-form-modal';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAuthSnapshot, hasAnyPermission } from '@/lib/authz';

const EMPLOYEE_READ_PERMISSIONS = [
  'employees:read',
  'employees:read_unit',
  'employees:read_own',
];

const EMPLOYEE_WRITE_PERMISSIONS = ['employees:write'];

const getStatusBadge = (status: EmployeeStatus) => {
  switch (status) {
    case EmployeeStatus.WORKING:
      return <Badge>Dang cong tac</Badge>;
    case EmployeeStatus.ON_LEAVE:
      return <Badge variant="secondary">Nghi phep</Badge>;
    case EmployeeStatus.LONG_LEAVE:
      return <Badge variant="secondary">Nghi dai han</Badge>;
    case EmployeeStatus.RESIGNED:
      return <Badge variant="destructive">Da nghi viec</Badge>;
    case EmployeeStatus.RETIRED:
      return <Badge variant="outline">Da nghi huu</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getGenderLabel = (gender: Employee['gender']) => {
  if (gender === 'NAM') {
    return 'Nam';
  }

  if (gender === 'NU') {
    return 'Nu';
  }

  return gender;
};

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const authSnapshot = useMemo(() => getAuthSnapshot(), []);

  const canReadEmployees = hasAnyPermission(
    authSnapshot.permissions,
    EMPLOYEE_READ_PERMISSIONS,
  );
  const canManageEmployees = hasAnyPermission(
    authSnapshot.permissions,
    EMPLOYEE_WRITE_PERMISSIONS,
  );

  const query = useMemo(
    () => ({
      page: 1,
      limit: 50,
      search: search.trim() || undefined,
    }),
    [search],
  );

  const { data, error, isLoading, mutate } = useSWR(
    canReadEmployees ? ['employees', query] : null,
    () => employeesService.getAll(query),
  );

  if (!canReadEmployees) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Ban khong co quyen truy cap danh sach nhan su.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Danh sach nhan su
          </h1>
          <p className="text-sm text-muted-foreground">
            Quan ly ho so nhan su trong he thong.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tai lai
          </Button>
          {canManageEmployees ? (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-brand-cyan text-white hover:bg-brand-cyan/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Them moi
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bo loc</CardTitle>
          <CardDescription>Tim theo ma vien chuc hoac ho ten.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Nhap ma vien chuc hoac ho ten..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sach</CardTitle>
          <CardDescription>Tong so: {data?.total ?? 0}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              Khong the tai du lieu nhan su.
            </div>
          ) : null}

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Dang tai...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Ma VC</TableHead>
                  <TableHead>Ho va ten</TableHead>
                  <TableHead>Don vi</TableHead>
                  <TableHead>Gioi tinh</TableHead>
                  <TableHead>Ngay sinh</TableHead>
                  <TableHead>Trang thai</TableHead>
                  <TableHead className="w-[100px] text-right">Chi tiet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length ? (
                  data.data.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.employeeCode}</TableCell>
                      <TableCell>{employee.fullName}</TableCell>
                      <TableCell>{employee.unit?.name ?? '-'}</TableCell>
                      <TableCell>{getGenderLabel(employee.gender)}</TableCell>
                      <TableCell>{new Date(employee.dob).toLocaleDateString('vi-VN')}</TableCell>
                      <TableCell>{getStatusBadge(employee.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/employees/${employee.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Xem
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Khong co du lieu.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManageEmployees ? (
        <EmployeeFormModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onSaved={() => {
            void mutate();
          }}
        />
      ) : null}
    </div>
  );
}
