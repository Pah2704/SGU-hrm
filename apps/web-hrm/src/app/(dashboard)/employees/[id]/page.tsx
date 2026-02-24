'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@/services/employees.service';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Edit, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ContractsTab } from '@/components/employees/contracts-tab';
import { EmployeeFormModal } from '@/components/employees/employee-form-modal';
import { EducationTab } from '@/components/employees/education-tab';
import {
  WorkProcessTab,
  AppointmentManagementTab,
} from '@/components/employees/history-tab';
import { SalaryTab } from '@/components/employees/salary-tab';

type StoredRole = string | { name?: string };
type StoredUser = {
  roles?: StoredRole[];
  permissions?: string[];
} | null;

type JwtClaims = {
  roles?: string[];
  permissions?: string[];
};

type ViewerAccess = {
  canEditProfile: boolean;
  canViewDecisions: boolean;
  canManageDecisions: boolean;
  canReadEducation: boolean;
  canWriteEducation: boolean;
  canApproveEducation: boolean;
  canReadSalary: boolean;
  canWriteSalary: boolean;
};

const HR_ROLE_NAMES = new Set(['HR_ADMIN', 'SUPER_ADMIN']);
const PERMISSION_CODES = {
  EMPLOYEES_WRITE: 'employees:write',
  EMPLOYEES_READ_OWN: 'employees:read_own',
  DECISIONS_READ: 'decisions:read',
  DECISIONS_WRITE: 'decisions:write',
  EDUCATION_READ: 'education:read',
  EDUCATION_WRITE: 'education:write',
  EDUCATION_APPROVE: 'education:approve',
  SALARY_READ: 'salary:read',
  SALARY_READ_OWN: 'salary:read_own',
  SALARY_WRITE: 'salary:write',
} as const;

const parseStoredUser = (raw: string | null): StoredUser => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
};

const decodeJwtClaims = (token: string | null): JwtClaims => {
  if (!token) {
    return {};
  }

  const tokenParts = token.split('.');
  if (tokenParts.length < 2) {
    return {};
  }

  try {
    const payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalizedPayload =
      payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(atob(normalizedPayload)) as JwtClaims;
    return decoded ?? {};
  } catch {
    return {};
  }
};

const extractRoleNames = (roles: StoredRole[] | undefined): Set<string> => {
  const roleNames = new Set<string>();

  for (const role of roles ?? []) {
    if (typeof role === 'string' && role.trim()) {
      roleNames.add(role);
      continue;
    }

    if (role && typeof role === 'object' && role.name) {
      roleNames.add(role.name);
    }
  }

  return roleNames;
};

const hasAnyRole = (roleNames: Set<string>) => {
  for (const roleName of roleNames) {
    if (HR_ROLE_NAMES.has(roleName)) {
      return true;
    }
  }

  return false;
};

export default function EmployeeDetailPage() {
  const queryClient = useQueryClient();
  const params = useParams<{ id?: string | string[] }>();
  const employeeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [viewerAccess, setViewerAccess] = useState<ViewerAccess>({
    canEditProfile: false,
    canViewDecisions: false,
    canManageDecisions: false,
    canReadEducation: false,
    canWriteEducation: false,
    canApproveEducation: false,
    canReadSalary: false,
    canWriteSalary: false,
  });

  useEffect(() => {
    const storedUser = parseStoredUser(localStorage.getItem('user'));
    const claims = decodeJwtClaims(localStorage.getItem('accessToken'));
    const roleNames = extractRoleNames(storedUser?.roles);
    const permissionCodes = new Set<string>([
      ...(storedUser?.permissions ?? []),
      ...(claims.permissions ?? []),
    ]);

    for (const roleFromToken of claims.roles ?? []) {
      if (roleFromToken?.trim()) {
        roleNames.add(roleFromToken);
      }
    }

    const isHrOrAdmin = hasAnyRole(roleNames);

    setViewerAccess({
      canEditProfile:
        isHrOrAdmin ||
        permissionCodes.has(PERMISSION_CODES.EMPLOYEES_WRITE),
      canViewDecisions:
        isHrOrAdmin || permissionCodes.has(PERMISSION_CODES.DECISIONS_READ),
      canManageDecisions:
        isHrOrAdmin || permissionCodes.has(PERMISSION_CODES.DECISIONS_WRITE),
      canReadEducation:
        isHrOrAdmin ||
        permissionCodes.has(PERMISSION_CODES.EDUCATION_READ) ||
        permissionCodes.has(PERMISSION_CODES.EMPLOYEES_READ_OWN),
      canWriteEducation:
        isHrOrAdmin ||
        permissionCodes.has(PERMISSION_CODES.EDUCATION_WRITE) ||
        permissionCodes.has(PERMISSION_CODES.EMPLOYEES_WRITE),
      canApproveEducation:
        isHrOrAdmin ||
        permissionCodes.has(PERMISSION_CODES.EDUCATION_APPROVE),
      canReadSalary:
        isHrOrAdmin ||
        permissionCodes.has(PERMISSION_CODES.SALARY_READ) ||
        permissionCodes.has(PERMISSION_CODES.SALARY_READ_OWN),
      canWriteSalary:
        isHrOrAdmin ||
        permissionCodes.has(PERMISSION_CODES.SALARY_WRITE),
    });
  }, []);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => employeesService.getOne(employeeId as string),
    enabled: Boolean(employeeId),
  });

  const canViewWorkHistory =
    viewerAccess.canViewDecisions || viewerAccess.canManageDecisions;
  const showHrDecisionTab = viewerAccess.canManageDecisions;
  const canAccessEducation =
    viewerAccess.canReadEducation ||
    viewerAccess.canWriteEducation ||
    viewerAccess.canApproveEducation;

  const defaultTab = useMemo(() => 'overview', []);

  if (isLoading) {
    return <div className="p-8">Đang tải thông tin nhân sự...</div>;
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <h2 className="text-xl font-semibold">Không tìm thấy nhân sự</h2>
        <Button variant="outline" asChild>
          <Link href="/employees">Quay lại danh sách</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/employees">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{employee.fullName}</h2>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{employee.employeeCode}</span>
            <span>•</span>
            <span>{employee.unit?.name}</span>
          </div>
        </div>
        {viewerAccess.canEditProfile ? (
          <div className="ml-auto">
            <Button onClick={() => setIsProfileModalOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Cập nhật hồ sơ
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card className="h-fit md:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="h-24 w-24">
              <AvatarImage
                src={employee.avatarUrl || undefined}
                alt={employee.fullName}
              />
              <AvatarFallback>{employee.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <CardTitle className="mt-4">{employee.fullName}</CardTitle>
            <CardDescription>{employee.jobTitle || 'Chưa định danh'}</CardDescription>
            <Badge variant="outline" className="mt-2">
              {employee.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted-foreground">
                Email
              </span>
              <span className="truncate text-sm">
                {employee.email || 'Chưa cập nhật'}
              </span>
            </div>
            <Separator />
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted-foreground">
                Điện thoại
              </span>
              <span className="text-sm">{employee.phone || 'Chưa cập nhật'}</span>
            </div>
            <Separator />
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted-foreground">
                Ngày sinh
              </span>
              <span className="text-sm">
                {new Date(employee.dob).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="contracts">Hợp đồng</TabsTrigger>
              <TabsTrigger value="relationships">Quan hệ gia đình</TabsTrigger>
              {canAccessEducation ? (
                <TabsTrigger value="education">Đào tạo & Bồi dưỡng</TabsTrigger>
              ) : null}
              <TabsTrigger value="process">Quá trình công tác</TabsTrigger>
              {showHrDecisionTab ? (
                <TabsTrigger value="appointments">
                  Bổ nhiệm / Điều động
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="salary">Lương & Phụ cấp</TabsTrigger>
            </TabsList>

            <TabsContent value="contracts" className="mt-6">
              <ContractsTab employeeId={employee.id} />
            </TabsContent>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin chung</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      CCCD/CMND
                    </span>
                    <span>{employee.citizenId}</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Ngày cấp
                    </span>
                    <span>
                      {employee.citizenCardDate
                        ? new Date(employee.citizenCardDate).toLocaleDateString(
                            'vi-VN',
                          )
                        : '---'}
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Nơi cấp
                    </span>
                    <span>{employee.citizenCardPlace || '---'}</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Giới tính
                    </span>
                    <span>{employee.gender === 'NAM' ? 'Nam' : 'Nữ'}</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Dân tộc
                    </span>
                    <span>{employee.ethnicityId || '---'}</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Tôn giáo
                    </span>
                    <span>{employee.religionId || '---'}</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Học vị cao nhất
                    </span>
                    <span>{employee.highestDegree || '---'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Thông tin tuyển dụng</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Ngày tuyển dụng lần đầu
                    </span>
                    <span>
                      {employee.initialRecruitmentDate
                        ? new Date(employee.initialRecruitmentDate).toLocaleDateString(
                            'vi-VN',
                          )
                        : '---'}
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Cơ quan tuyển dụng
                    </span>
                    <span>{employee.initialRecruitmentAgency || '---'}</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Ngày về cơ quan hiện tại
                    </span>
                    <span>
                      {employee.currentOrgJoinDate
                        ? new Date(employee.currentOrgJoinDate).toLocaleDateString(
                            'vi-VN',
                          )
                        : '---'}
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Ngày vào biên chế chính thức
                    </span>
                    <span>
                      {employee.officialDate
                        ? new Date(employee.officialDate).toLocaleDateString(
                            'vi-VN',
                          )
                        : '---'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="relationships">
              <Card>
                <CardHeader>
                  <CardTitle>Quan hệ gia đình</CardTitle>
                  <CardDescription>
                    Danh sách người phụ thuộc và quan hệ thân nhân
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="py-8 text-center text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {canAccessEducation ? (
              <TabsContent value="education" className="mt-6">
                <EducationTab
                  employeeId={employee.id}
                  canWrite={viewerAccess.canWriteEducation}
                  canApprove={viewerAccess.canApproveEducation}
                  onChanged={() => {
                    void queryClient.invalidateQueries({
                      queryKey: ['employee', employeeId],
                    });
                  }}
                />
              </TabsContent>
            ) : null}

            <TabsContent value="process" className="mt-6">
              <WorkProcessTab
                employeeId={employee.id}
                canView={canViewWorkHistory}
                canManage={viewerAccess.canManageDecisions}
              />
            </TabsContent>

            {showHrDecisionTab ? (
              <TabsContent value="appointments" className="mt-6">
                <AppointmentManagementTab
                  employeeId={employee.id}
                  canView={canViewWorkHistory}
                  canManage={viewerAccess.canManageDecisions}
                />
              </TabsContent>
            ) : null}

            {viewerAccess.canReadSalary ? (
              <TabsContent value="salary" className="mt-6">
                <SalaryTab
                  employeeId={employee.id}
                  canWrite={viewerAccess.canWriteSalary}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </div>

      <EmployeeFormModal
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
        employeeToEdit={employee}
        onSaved={() => {
          void Promise.all([
            queryClient.invalidateQueries({
              queryKey: ['employee', employeeId],
            }),
            queryClient.invalidateQueries({
              queryKey: ['employees'],
            }),
          ]);
        }}
      />
    </div>
  );
}
