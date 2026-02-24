import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../../common/constants';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'any_permissions';

/**
 * Require ALL of the specified permissions
 * @example
 * @RequirePermissions(PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.EMPLOYEES_EXPORT)
 * @Get()
 * findAll() {}
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Require ANY of the specified permissions
 * @example
 * @RequireAnyPermissions(PERMISSIONS.SALARY_READ, PERMISSIONS.SALARY_READ_OWN)
 * @Get('employees/:employeeId/salary-records')
 * listRecords() {}
 */
export const RequireAnyPermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
