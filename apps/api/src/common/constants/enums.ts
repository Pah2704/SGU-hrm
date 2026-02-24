/**
 * Centralized Enums for SGU-HRM
 * All application-level enums in one place for easy maintenance
 * Note: Prisma enums are defined in schema.prisma
 */

// ═══════════════════════════════════════════════════════════════════
// ROLES (System-defined roles)
// ═══════════════════════════════════════════════════════════════════

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  CONTENT_ADMIN: 'CONTENT_ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// Role hierarchy (higher index = higher privilege)
export const ROLE_HIERARCHY: RoleName[] = [
  ROLES.EMPLOYEE,
  ROLES.MANAGER,
  ROLES.CONTENT_ADMIN,
  ROLES.HR_ADMIN,
  ROLES.SUPER_ADMIN,
];

// ═══════════════════════════════════════════════════════════════════
// PERMISSION MODULES
// ═══════════════════════════════════════════════════════════════════

export const PERMISSION_MODULES = {
  EMPLOYEES: 'employees',
  CONTRACTS: 'contracts',
  SALARY: 'salary',
  LEAVES: 'leaves',
  RECRUITMENT: 'recruitment',
  EDUCATION: 'education',
  ORGANIZATIONS: 'organizations',
  CMS: 'cms',
  JOBS: 'jobs',
  SYSTEM: 'system',
} as const;

// ═══════════════════════════════════════════════════════════════════
// PERMISSION ACTIONS
// ═══════════════════════════════════════════════════════════════════

export const PERMISSION_ACTIONS = {
  READ: 'read',
  READ_OWN: 'read_own',
  READ_UNIT: 'read_unit',
  WRITE: 'write',
  DELETE: 'delete',
  EXPORT: 'export',
  APPROVE: 'approve',
  CONVERT: 'convert',
  MANAGE: 'manage',
  PUBLISH: 'publish',
} as const;

// ═══════════════════════════════════════════════════════════════════
// EMPLOYEE STATUS LABELS (for UI)
// ═══════════════════════════════════════════════════════════════════

export const EMPLOYEE_STATUS_LABELS = {
  WORKING: 'Đang làm việc',
  ON_LEAVE: 'Nghỉ phép',
  LONG_LEAVE: 'Nghỉ dài hạn',
  RESIGNED: 'Đã nghỉ việc',
  RETIRED: 'Đã nghỉ hưu',
} as const;

// ═══════════════════════════════════════════════════════════════════
// CONTRACT TYPE LABELS
// ═══════════════════════════════════════════════════════════════════

export const CONTRACT_TYPE_LABELS = {
  HDLD_XAC_DINH: 'HĐLĐ xác định thời hạn',
  HDLD_KHONG_XAC_DINH: 'HĐLĐ không xác định thời hạn',
  HDLV: 'Hợp đồng làm việc',
  THU_VIEC: 'Hợp đồng thử việc',
} as const;

// ═══════════════════════════════════════════════════════════════════
// DEGREE TYPE LABELS
// ═══════════════════════════════════════════════════════════════════

export const DEGREE_TYPE_LABELS = {
  TRUNG_CAP: 'Trung cấp',
  CAO_DANG: 'Cao đẳng',
  DAI_HOC: 'Đại học',
  THAC_SI: 'Thạc sĩ',
  TIEN_SI: 'Tiến sĩ',
} as const;

// Degree ranking for highest_degree calculation
export const DEGREE_RANK = {
  TRUNG_CAP: 1,
  CAO_DANG: 2,
  DAI_HOC: 3,
  THAC_SI: 4,
  TIEN_SI: 5,
} as const;

// ═══════════════════════════════════════════════════════════════════
// RANK GROUP CONSTANTS (for salary calculation)
// ═══════════════════════════════════════════════════════════════════

// Months to raise for each rank group
export const RANK_RAISE_MONTHS = {
  A0: 36,
  A1: 36,
  A2_1: 36,
  A2_2: 36,
  A3_1: 36,
  A3_2: 36,
  B: 24,
} as const;

// Discipline penalty months
export const DISCIPLINE_PENALTY_MONTHS = {
  KHIEN_TRACH: 3,
  CANH_CAO: 6,
  CACH_CHUC: 12,
} as const;

// ═══════════════════════════════════════════════════════════════════
// UNIT TYPE LABELS
// ═══════════════════════════════════════════════════════════════════

export const UNIT_TYPE_LABELS = {
  TRUONG: 'Trường',
  KHOA: 'Khoa',
  PHONG: 'Phòng',
  BAN: 'Ban',
  TRUNG_TAM: 'Trung tâm',
  TO_BO_MON: 'Tổ/Bộ môn',
} as const;

// ═══════════════════════════════════════════════════════════════════
// APPROVAL STATUS LABELS
// ═══════════════════════════════════════════════════════════════════

export const APPROVAL_STATUS_LABELS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
} as const;

// ═══════════════════════════════════════════════════════════════════
// LEAVE CATEGORY LABELS
// ═══════════════════════════════════════════════════════════════════

export const LEAVE_CATEGORY_LABELS = {
  PAID_SCHOOL: 'Hưởng lương trường',
  PAID_BHXH: 'Hưởng BHXH',
  UNPAID: 'Không lương',
} as const;
