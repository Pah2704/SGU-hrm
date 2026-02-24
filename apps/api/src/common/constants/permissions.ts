/**
 * Centralized Permission Definitions for SGU-HRM
 * Format: module:action or module:action_scope
 * Single source of truth for all RBAC permissions
 */

import { ROLES } from './enums';

// ═══════════════════════════════════════════════════════════════════
// PERMISSION DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const PERMISSIONS = {
  // ─────────────────────────────────────────────────────────────────
  // EMPLOYEES
  // ─────────────────────────────────────────────────────────────────
  EMPLOYEES_READ: 'employees:read',
  EMPLOYEES_READ_OWN: 'employees:read_own',
  EMPLOYEES_READ_UNIT: 'employees:read_unit',
  EMPLOYEES_WRITE: 'employees:write',
  EMPLOYEES_DELETE: 'employees:delete',
  EMPLOYEES_EXPORT: 'employees:export',

  // ─────────────────────────────────────────────────────────────────
  // CONTRACTS
  // ─────────────────────────────────────────────────────────────────
  CONTRACTS_READ: 'contracts:read',
  CONTRACTS_WRITE: 'contracts:write',
  CONTRACTS_EXPORT: 'contracts:export',

  // ─────────────────────────────────────────────────────────────────
  // SALARY
  // ─────────────────────────────────────────────────────────────────
  SALARY_READ: 'salary:read',
  SALARY_READ_OWN: 'salary:read_own',
  SALARY_WRITE: 'salary:write',
  SALARY_CONFIG_MANAGE: 'salary:config_manage',

  // ─────────────────────────────────────────────────────────────────
  // LEAVES
  // ─────────────────────────────────────────────────────────────────
  LEAVES_READ: 'leaves:read',
  LEAVES_READ_UNIT: 'leaves:read_unit',
  LEAVES_READ_OWN: 'leaves:read_own',
  LEAVES_WRITE: 'leaves:write',
  LEAVES_APPROVE: 'leaves:approve',

  // ─────────────────────────────────────────────────────────────────
  // RECRUITMENT
  // ─────────────────────────────────────────────────────────────────
  RECRUITMENT_READ: 'recruitment:read',
  RECRUITMENT_WRITE: 'recruitment:write',
  RECRUITMENT_CONVERT: 'recruitment:convert',

  // ─────────────────────────────────────────────────────────────────
  // EDUCATION
  // ─────────────────────────────────────────────────────────────────
  EDUCATION_READ: 'education:read',
  EDUCATION_WRITE: 'education:write',
  EDUCATION_APPROVE: 'education:approve',

  // ─────────────────────────────────────────────────────────────────
  // ORGANIZATIONS
  // ─────────────────────────────────────────────────────────────────
  ORGANIZATIONS_READ: 'organizations:read',
  ORGANIZATIONS_WRITE: 'organizations:write',

  // ─────────────────────────────────────────────────────────────────
  // POSITIONS
  // ─────────────────────────────────────────────────────────────────
  POSITIONS_READ: 'positions:read',
  POSITIONS_WRITE: 'positions:write',

  // ─────────────────────────────────────────────────────────────────
  // DECISIONS (Employee History)
  // ─────────────────────────────────────────────────────────────────
  DECISIONS_READ: 'decisions:read',
  DECISIONS_WRITE: 'decisions:write',

  // ─────────────────────────────────────────────────────────────────
  // CMS
  // ─────────────────────────────────────────────────────────────────
  CMS_POSTS_MANAGE: 'cms:posts_manage',
  CMS_POSTS_PUBLISH: 'cms:posts_publish',
  CMS_DOCUMENTS_MANAGE: 'cms:documents_manage',
  CMS_CATEGORIES_MANAGE: 'cms:categories_manage',

  // ─────────────────────────────────────────────────────────────────
  // JOBS (Background jobs - Admin only)
  // ─────────────────────────────────────────────────────────────────
  JOBS_SALARY_SCAN: 'jobs:salary_scan',
  JOBS_CONTRACT_ALERT: 'jobs:contract_alert',
  JOBS_EXPORT_BULK: 'jobs:export_bulk',

  // ─────────────────────────────────────────────────────────────────
  // SYSTEM (Super Admin only)
  // ─────────────────────────────────────────────────────────────────
  SYSTEM_USERS_MANAGE: 'system:users_manage',
  SYSTEM_ROLES_MANAGE: 'system:roles_manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ═══════════════════════════════════════════════════════════════════
// DEFAULT ROLE PERMISSIONS
// Used for seeding the database
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS), // All permissions

  [ROLES.HR_ADMIN]: [
    // Employees
    PERMISSIONS.EMPLOYEES_READ,
    PERMISSIONS.EMPLOYEES_READ_OWN,
    PERMISSIONS.EMPLOYEES_READ_UNIT,
    PERMISSIONS.EMPLOYEES_WRITE,
    PERMISSIONS.EMPLOYEES_DELETE,
    PERMISSIONS.EMPLOYEES_EXPORT,
    // Contracts
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.CONTRACTS_WRITE,
    PERMISSIONS.CONTRACTS_EXPORT,
    // Salary
    PERMISSIONS.SALARY_READ,
    PERMISSIONS.SALARY_READ_OWN,
    PERMISSIONS.SALARY_WRITE,
    PERMISSIONS.SALARY_CONFIG_MANAGE,
    // Leaves
    PERMISSIONS.LEAVES_READ,
    PERMISSIONS.LEAVES_READ_UNIT,
    PERMISSIONS.LEAVES_READ_OWN,
    PERMISSIONS.LEAVES_WRITE,
    PERMISSIONS.LEAVES_APPROVE,
    // Recruitment
    PERMISSIONS.RECRUITMENT_READ,
    PERMISSIONS.RECRUITMENT_WRITE,
    PERMISSIONS.RECRUITMENT_CONVERT,
    // Education
    PERMISSIONS.EDUCATION_READ,
    PERMISSIONS.EDUCATION_WRITE,
    PERMISSIONS.EDUCATION_APPROVE,
    // Organizations
    PERMISSIONS.ORGANIZATIONS_READ,
    PERMISSIONS.ORGANIZATIONS_READ,
    PERMISSIONS.ORGANIZATIONS_WRITE,
    // Positions & Decisions
    PERMISSIONS.POSITIONS_READ,
    PERMISSIONS.POSITIONS_WRITE,
    PERMISSIONS.DECISIONS_READ,
    PERMISSIONS.DECISIONS_WRITE,
    // CMS
    PERMISSIONS.CMS_POSTS_MANAGE,
    PERMISSIONS.CMS_POSTS_PUBLISH,
    PERMISSIONS.CMS_DOCUMENTS_MANAGE,
    PERMISSIONS.CMS_CATEGORIES_MANAGE,
    // Jobs
    PERMISSIONS.JOBS_SALARY_SCAN,
    PERMISSIONS.JOBS_CONTRACT_ALERT,
    PERMISSIONS.JOBS_EXPORT_BULK,
    // System
    PERMISSIONS.SYSTEM_USERS_MANAGE,
  ],

  [ROLES.CONTENT_ADMIN]: [
    PERMISSIONS.CMS_POSTS_MANAGE,
    PERMISSIONS.CMS_DOCUMENTS_MANAGE,
    PERMISSIONS.CMS_CATEGORIES_MANAGE,
    PERMISSIONS.ORGANIZATIONS_READ,
  ],

  [ROLES.MANAGER]: [
    PERMISSIONS.EMPLOYEES_READ_UNIT,
    PERMISSIONS.EMPLOYEES_READ_OWN,
    PERMISSIONS.SALARY_READ_OWN,
    PERMISSIONS.LEAVES_READ_UNIT,
    PERMISSIONS.LEAVES_READ_OWN,
    PERMISSIONS.LEAVES_APPROVE,
    PERMISSIONS.EDUCATION_READ,
    PERMISSIONS.ORGANIZATIONS_READ,
  ],

  [ROLES.EMPLOYEE]: [
    PERMISSIONS.EMPLOYEES_READ_OWN,
    PERMISSIONS.SALARY_READ_OWN,
    PERMISSIONS.LEAVES_READ_OWN,
    PERMISSIONS.LEAVES_WRITE,
    PERMISSIONS.EDUCATION_READ,
    PERMISSIONS.EDUCATION_WRITE,
  ],
};

// ═══════════════════════════════════════════════════════════════════
// PERMISSION METADATA (for UI and seed)
// ═══════════════════════════════════════════════════════════════════

export interface PermissionMeta {
  code: PermissionCode;
  module: string;
  action: string;
  scope?: string;
  description: string;
}

export const PERMISSION_METADATA: PermissionMeta[] = [
  // Employees
  {
    code: PERMISSIONS.EMPLOYEES_READ,
    module: 'employees',
    action: 'read',
    description: 'Xem tất cả hồ sơ nhân sự',
  },
  {
    code: PERMISSIONS.EMPLOYEES_READ_OWN,
    module: 'employees',
    action: 'read',
    scope: 'own',
    description: 'Xem hồ sơ cá nhân',
  },
  {
    code: PERMISSIONS.EMPLOYEES_READ_UNIT,
    module: 'employees',
    action: 'read',
    scope: 'unit',
    description: 'Xem hồ sơ nhân sự trong đơn vị',
  },
  {
    code: PERMISSIONS.EMPLOYEES_WRITE,
    module: 'employees',
    action: 'write',
    description: 'Thêm/sửa hồ sơ nhân sự',
  },
  {
    code: PERMISSIONS.EMPLOYEES_DELETE,
    module: 'employees',
    action: 'delete',
    description: 'Xóa hồ sơ nhân sự',
  },
  {
    code: PERMISSIONS.EMPLOYEES_EXPORT,
    module: 'employees',
    action: 'export',
    description: 'Xuất danh sách nhân sự',
  },
  // Contracts
  {
    code: PERMISSIONS.CONTRACTS_READ,
    module: 'contracts',
    action: 'read',
    description: 'Xem hợp đồng',
  },
  {
    code: PERMISSIONS.CONTRACTS_WRITE,
    module: 'contracts',
    action: 'write',
    description: 'Thêm/sửa hợp đồng',
  },
  {
    code: PERMISSIONS.CONTRACTS_EXPORT,
    module: 'contracts',
    action: 'export',
    description: 'Xuất hợp đồng',
  },
  // Salary
  {
    code: PERMISSIONS.SALARY_READ,
    module: 'salary',
    action: 'read',
    description: 'Xem thông tin lương',
  },
  {
    code: PERMISSIONS.SALARY_READ_OWN,
    module: 'salary',
    action: 'read',
    scope: 'own',
    description: 'Xem lương cá nhân',
  },
  {
    code: PERMISSIONS.SALARY_WRITE,
    module: 'salary',
    action: 'write',
    description: 'Cập nhật thông tin lương',
  },
  {
    code: PERMISSIONS.SALARY_CONFIG_MANAGE,
    module: 'salary',
    action: 'config_manage',
    description: 'Quan ly cau hinh ngach va bac luong',
  },
  // Leaves
  {
    code: PERMISSIONS.LEAVES_READ,
    module: 'leaves',
    action: 'read',
    description: 'Xem tất cả đơn nghỉ phép',
  },
  {
    code: PERMISSIONS.LEAVES_READ_UNIT,
    module: 'leaves',
    action: 'read',
    scope: 'unit',
    description: 'Xem đơn nghỉ phép đơn vị',
  },
  {
    code: PERMISSIONS.LEAVES_READ_OWN,
    module: 'leaves',
    action: 'read',
    scope: 'own',
    description: 'Xem đơn nghỉ phép cá nhân',
  },
  {
    code: PERMISSIONS.LEAVES_WRITE,
    module: 'leaves',
    action: 'write',
    description: 'Tạo đơn nghỉ phép',
  },
  {
    code: PERMISSIONS.LEAVES_APPROVE,
    module: 'leaves',
    action: 'approve',
    description: 'Duyệt đơn nghỉ phép',
  },
  // Recruitment
  {
    code: PERMISSIONS.RECRUITMENT_READ,
    module: 'recruitment',
    action: 'read',
    description: 'Xem tuyển dụng',
  },
  {
    code: PERMISSIONS.RECRUITMENT_WRITE,
    module: 'recruitment',
    action: 'write',
    description: 'Quản lý đợt tuyển dụng',
  },
  {
    code: PERMISSIONS.RECRUITMENT_CONVERT,
    module: 'recruitment',
    action: 'convert',
    description: 'Chuyển ứng viên thành nhân sự',
  },
  // Education
  {
    code: PERMISSIONS.EDUCATION_READ,
    module: 'education',
    action: 'read',
    description: 'Xem văn bằng/chứng chỉ',
  },
  {
    code: PERMISSIONS.EDUCATION_WRITE,
    module: 'education',
    action: 'write',
    description: 'Upload văn bằng/chứng chỉ',
  },
  {
    code: PERMISSIONS.EDUCATION_APPROVE,
    module: 'education',
    action: 'approve',
    description: 'Duyệt văn bằng/chứng chỉ',
  },
  // Organizations
  {
    code: PERMISSIONS.ORGANIZATIONS_READ,
    module: 'organizations',
    action: 'read',
    description: 'Xem cơ cấu tổ chức',
  },
  {
    code: PERMISSIONS.ORGANIZATIONS_WRITE,
    module: 'organizations',
    action: 'write',
    description: 'Quản lý đơn vị',
  },
  // Positions
  {
    code: PERMISSIONS.POSITIONS_READ,
    module: 'positions',
    action: 'read',
    description: 'Xem danh mục chức vụ',
  },
  {
    code: PERMISSIONS.POSITIONS_WRITE,
    module: 'positions',
    action: 'write',
    description: 'Quản lý chức vụ',
  },
  // Decisions
  {
    code: PERMISSIONS.DECISIONS_READ,
    module: 'decisions',
    action: 'read',
    description: 'Xem lịch sử công tác',
  },
  {
    code: PERMISSIONS.DECISIONS_WRITE,
    module: 'decisions',
    action: 'write',
    description: 'Quyết định bổ nhiệm/điều động',
  },
  // CMS
  {
    code: PERMISSIONS.CMS_POSTS_MANAGE,
    module: 'cms',
    action: 'posts_manage',
    description: 'Quản lý bài viết',
  },
  {
    code: PERMISSIONS.CMS_POSTS_PUBLISH,
    module: 'cms',
    action: 'posts_publish',
    description: 'Đăng/Gỡ bài viết',
  },
  {
    code: PERMISSIONS.CMS_DOCUMENTS_MANAGE,
    module: 'cms',
    action: 'documents_manage',
    description: 'Quản lý văn bản',
  },
  {
    code: PERMISSIONS.CMS_CATEGORIES_MANAGE,
    module: 'cms',
    action: 'categories_manage',
    description: 'Quản lý danh mục',
  },
  // Jobs
  {
    code: PERMISSIONS.JOBS_SALARY_SCAN,
    module: 'jobs',
    action: 'salary_scan',
    description: 'Chạy quét nâng lương',
  },
  {
    code: PERMISSIONS.JOBS_CONTRACT_ALERT,
    module: 'jobs',
    action: 'contract_alert',
    description: 'Gửi cảnh báo hợp đồng',
  },
  {
    code: PERMISSIONS.JOBS_EXPORT_BULK,
    module: 'jobs',
    action: 'export_bulk',
    description: 'Xuất hàng loạt',
  },
  // System
  {
    code: PERMISSIONS.SYSTEM_USERS_MANAGE,
    module: 'system',
    action: 'users_manage',
    description: 'Quản lý tài khoản',
  },
  {
    code: PERMISSIONS.SYSTEM_ROLES_MANAGE,
    module: 'system',
    action: 'roles_manage',
    description: 'Quản lý vai trò',
  },
];
