'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { employeesService } from '@/services/employees.service';
import { EducationTab } from '@/components/employees/education-tab';
import { getAuthSnapshot, hasAnyPermission } from '@/lib/authz';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const EDUCATION_MANAGEMENT_PERMISSIONS = ['education:read', 'education:approve'];
const EDUCATION_WRITE_PERMISSIONS = ['education:write', 'employees:write'];

type EmployeeOption = {
  id: string;
  employeeCode: string;
  fullName: string;
};

export default function EducationManagementPage() {
  const authSnapshot = useMemo(() => getAuthSnapshot(), []);

  const canManageEducation = hasAnyPermission(
    authSnapshot.permissions,
    EDUCATION_MANAGEMENT_PERMISSIONS,
  );
  const canWriteEducation = hasAnyPermission(
    authSnapshot.permissions,
    EDUCATION_WRITE_PERMISSIONS,
  );
  const canApproveEducation = hasAnyPermission(authSnapshot.permissions, [
    'education:approve',
  ]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const {
    data: employeesResponse,
    error,
    isLoading,
    mutate,
  } = useSWR(
    canManageEducation ? ['education-management-employees'] : null,
    () => employeesService.getAll({ page: 1, limit: 200 }),
  );

  const employees = useMemo<EmployeeOption[]>(
    () => employeesResponse?.data ?? [],
    [employeesResponse?.data],
  );

  useEffect(() => {
    if (!employees.length) {
      return;
    }

    setSelectedEmployeeId((previous) => {
      if (previous && employees.some((employee) => employee.id === previous)) {
        return previous;
      }

      return employees[0].id;
    });
  }, [employees]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );

  if (!canManageEducation) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Ban khong co quyen truy cap chuc nang quan ly dao tao.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Quan ly dao tao
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo doi va phe duyet van bang, chung chi cho nhan su.
          </p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tai lai
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chon nhan su</CardTitle>
          <CardDescription>
            Chon ho so can xem va xu ly dao tao.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {employees.length ? null : <option value="">Khong co du lieu nhan su</option>}
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName} ({employee.employeeCode})
              </option>
            ))}
          </select>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Dang tai danh sach nhan su...</p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive">Khong the tai danh sach nhan su.</p>
          ) : null}
        </CardContent>
      </Card>

      {selectedEmployee ? (
        <Card>
          <CardHeader>
            <CardTitle>{selectedEmployee.fullName}</CardTitle>
            <CardDescription>Ma vien chuc: {selectedEmployee.employeeCode}</CardDescription>
          </CardHeader>
          <CardContent>
            <EducationTab
              employeeId={selectedEmployee.id}
              canWrite={canWriteEducation}
              canApprove={canApproveEducation}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
