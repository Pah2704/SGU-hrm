/**
 * Database seed script
 *
 * Run:
 *   npx prisma db seed
 */

import {
  EmployeeStatus,
  Gender,
  LeaveCategory,
  PrismaClient,
  RankGroup,
  UnitStatus,
  UnitType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_METADATA,
  ROLES,
  deriveSectorGroup,
} from '../src/common/constants';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

type UnitSeedInput = {
  code: string;
  name: string;
  shortName?: string;
  unitType: UnitType;
  parentCode?: string;
  sortOrder?: number;
};

type LinkedAccountSeed = {
  email: string;
  password: string;
  fullName: string;
  employeeCode: string;
  citizenId: string;
  dob: string;
  gender: Gender;
  unitCode: string;
  roleNames: string[];
  managerScopeUnitCode?: string;
};

const toPathSegment = (code: string): string =>
  code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const DEFAULT_GROUP_COEFFICIENTS: Record<RankGroup, number[]> = {
  A0: [2.1, 2.41, 2.72, 3.03, 3.34, 3.65, 3.96, 4.27, 4.58, 4.89],
  A1: [2.34, 2.67, 3.0, 3.33, 3.66, 3.99, 4.32, 4.65, 4.98],
  A2_1: [4.4, 4.74, 5.08, 5.42, 5.76, 6.1, 6.44, 6.78],
  A2_2: [4.0, 4.34, 4.68, 5.02, 5.36, 5.7, 6.04, 6.38],
  A3_1: [6.2, 6.56, 6.92, 7.28, 7.64, 8.0],
  A3_2: [5.75, 6.11, 6.47, 6.83, 7.19, 7.55],
  B: [1.86, 2.06, 2.26, 2.46, 2.66, 2.86, 3.06, 3.26, 3.46, 3.66, 3.86, 4.06],
};

async function ensureRole(name: string) {
  const role = await prisma.role.findUnique({ where: { name } });
  if (!role) {
    throw new Error(`Role "${name}" was not found`);
  }
  return role;
}

async function ensureUnit(code: string) {
  const unit = await prisma.unit.findUnique({ where: { code } });
  if (!unit) {
    throw new Error(`Unit "${code}" was not found`);
  }
  return unit;
}

async function upsertUnit(input: UnitSeedInput) {
  const parent = input.parentCode
    ? await prisma.unit.findUnique({ where: { code: input.parentCode } })
    : null;

  if (input.parentCode && !parent) {
    throw new Error(
      `Parent unit "${input.parentCode}" not found for "${input.code}"`,
    );
  }

  const level = parent ? parent.level + 1 : 0;
  const path = parent
    ? `${parent.path}.${toPathSegment(input.code)}`
    : toPathSegment(input.code);

  return prisma.unit.upsert({
    where: { code: input.code },
    update: {
      name: input.name,
      shortName: input.shortName ?? null,
      unitType: input.unitType,
      status: UnitStatus.ACTIVE,
      parentId: parent?.id ?? null,
      path,
      level,
      sortOrder: input.sortOrder ?? 0,
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      code: input.code,
      name: input.name,
      shortName: input.shortName ?? null,
      unitType: input.unitType,
      status: UnitStatus.ACTIVE,
      parentId: parent?.id ?? null,
      path,
      level,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

async function ensureUserRole(userId: string, roleName: string, unitId?: string) {
  const role = await ensureRole(roleName);
  const scopeUnitId = unitId ?? null;

  const existing = await prisma.userRole.findFirst({
    where: {
      userId,
      roleId: role.id,
      unitId: scopeUnitId,
    },
  });

  if (!existing) {
    await prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
        unitId: scopeUnitId,
      },
    });
  }
}

async function upsertLinkedAccount(input: LinkedAccountSeed) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      passwordHash,
      isActive: true,
    },
    create: {
      email: input.email,
      passwordHash,
      isActive: true,
    },
  });

  const employeeUnit = await ensureUnit(input.unitCode);
  const managerScopeUnit = input.managerScopeUnitCode
    ? await ensureUnit(input.managerScopeUnitCode)
    : null;

  for (const roleName of input.roleNames) {
    const scopedUnitId =
      roleName === ROLES.MANAGER ? managerScopeUnit?.id : undefined;
    await ensureUserRole(user.id, roleName, scopedUnitId);
  }

  await prisma.employee.upsert({
    where: { userId: user.id },
    update: {
      employeeCode: input.employeeCode,
      citizenId: input.citizenId,
      fullName: input.fullName,
      dob: new Date(input.dob),
      gender: input.gender,
      email: input.email,
      unitId: employeeUnit.id,
      status: EmployeeStatus.WORKING,
      deletedAt: null,
    },
    create: {
      userId: user.id,
      employeeCode: input.employeeCode,
      citizenId: input.citizenId,
      fullName: input.fullName,
      dob: new Date(input.dob),
      gender: input.gender,
      email: input.email,
      unitId: employeeUnit.id,
      status: EmployeeStatus.WORKING,
    },
  });
}

async function main() {
  console.log('[seed] starting...');

  console.log('[seed] permissions');
  for (const meta of PERMISSION_METADATA) {
    await prisma.permission.upsert({
      where: { code: meta.code },
      update: {
        module: meta.module,
        action: meta.action,
        scope: meta.scope,
        description: meta.description,
      },
      create: {
        code: meta.code,
        module: meta.module,
        action: meta.action,
        scope: meta.scope,
        description: meta.description,
      },
    });
  }

  console.log('[seed] roles');
  const roles = [
    {
      name: ROLES.SUPER_ADMIN,
      displayName: 'Super Admin',
      description: 'Toan quyen he thong',
      isSystem: true,
    },
    {
      name: ROLES.HR_ADMIN,
      displayName: 'HR Admin',
      description: 'Quan tri nghiep vu nhan su',
      isSystem: true,
    },
    {
      name: ROLES.CONTENT_ADMIN,
      displayName: 'Content Admin',
      description: 'Quan ly noi dung CMS',
      isSystem: true,
    },
    {
      name: ROLES.MANAGER,
      displayName: 'Manager',
      description: 'Lanh dao don vi',
      isSystem: true,
    },
    {
      name: ROLES.EMPLOYEE,
      displayName: 'Employee',
      description: 'Nhan su',
      isSystem: true,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        displayName: role.displayName,
        description: role.description,
      },
      create: role,
    });
  }

  console.log('[seed] role permissions');
  for (const [roleName, permissionCodes] of Object.entries(
    DEFAULT_ROLE_PERMISSIONS,
  )) {
    const role = await ensureRole(roleName);

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    for (const code of Array.from(new Set(permissionCodes))) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) {
        continue;
      }

      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('[seed] default users');
  const defaultUsers = [
    { email: 'admin@sgu.edu.vn', password: 'Admin@123', role: ROLES.SUPER_ADMIN },
    { email: 'hr@sgu.edu.vn', password: 'Hr@12345', role: ROLES.HR_ADMIN },
  ];

  for (const item of defaultUsers) {
    const passwordHash = await bcrypt.hash(item.password, SALT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: { passwordHash, isActive: true },
      create: {
        email: item.email,
        passwordHash,
        isActive: true,
      },
    });

    await ensureUserRole(user.id, item.role);
  }

  console.log('[seed] master data');
  const ethnicities = [
    'Kinh',
    'Tay',
    'Thai',
    'Muong',
    'Khmer',
    'Hoa',
    'Nung',
    'Hmong',
    'Dao',
    'Gia Rai',
  ];
  for (const name of ethnicities) {
    await prisma.ethnicity.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const religions = [
    'Khong',
    'Phat giao',
    'Cong giao',
    'Tin lanh',
    'Hoi giao',
    'Cao dai',
    'Hoa hao',
  ];
  for (const name of religions) {
    await prisma.religion.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const ranks = [
    { code: 'V.07.01.01', name: 'Giang vien cao cap', rankGroup: RankGroup.A3_1 },
    { code: 'V.07.01.02', name: 'Giang vien chinh', rankGroup: RankGroup.A2_1 },
    { code: 'V.07.01.03', name: 'Giang vien', rankGroup: RankGroup.A1 },
    {
      code: 'V.01.01.01',
      name: 'Chuyen vien cao cap',
      rankGroup: RankGroup.A3_2,
    },
    { code: 'V.01.01.02', name: 'Chuyen vien chinh', rankGroup: RankGroup.A2_1 },
    { code: 'V.01.01.03', name: 'Chuyen vien', rankGroup: RankGroup.A1 },
    { code: 'V.01.02.03', name: 'Can su', rankGroup: RankGroup.A0 },
    { code: 'V.01.03.03', name: 'Nhan vien', rankGroup: RankGroup.B },
  ];
  for (const rank of ranks) {
    await prisma.civilServantRank.upsert({
      where: { code: rank.code },
      update: {
        name: rank.name,
        rankGroup: rank.rankGroup,
        sectorGroup: deriveSectorGroup(undefined),
      },
      create: {
        ...rank,
        sectorGroup: deriveSectorGroup(undefined),
      },
    });
  }

  console.log('[seed] units');
  await upsertUnit({
    code: 'SGU',
    name: 'Truong Dai hoc Sai Gon',
    shortName: 'SGU',
    unitType: UnitType.TRUONG,
    sortOrder: 0,
  });

  await upsertUnit({
    code: 'P_TCCB',
    name: 'Phong To chuc Can bo',
    shortName: 'P.TCCB',
    unitType: UnitType.PHONG,
    parentCode: 'SGU',
    sortOrder: 10,
  });

  await upsertUnit({
    code: 'K_CNTT',
    name: 'Khoa Cong nghe Thong tin',
    shortName: 'K.CNTT',
    unitType: UnitType.KHOA,
    parentCode: 'SGU',
    sortOrder: 20,
  });

  await upsertUnit({
    code: 'BM_CNPM',
    name: 'Bo mon Cong nghe Phan mem',
    shortName: 'BM.CNPM',
    unitType: UnitType.TO_BO_MON,
    parentCode: 'K_CNTT',
    sortOrder: 21,
  });

  console.log('[seed] linked user-employee accounts');
  const linkedAccounts: LinkedAccountSeed[] = [
    {
      email: 'hr@sgu.edu.vn',
      password: 'Hr@12345',
      fullName: 'PHAM THI NHAN SU',
      employeeCode: 'VC-HR-0001',
      citizenId: '079101000001',
      dob: '1986-11-05',
      gender: Gender.NU,
      unitCode: 'P_TCCB',
      roleNames: [ROLES.HR_ADMIN, ROLES.EMPLOYEE],
    },
    {
      email: 'manager.fit@sgu.edu.vn',
      password: 'Manager@123',
      fullName: 'TRAN VAN QUAN LY',
      employeeCode: 'VC-MGR-0001',
      citizenId: '079101000002',
      dob: '1985-07-20',
      gender: Gender.NAM,
      unitCode: 'K_CNTT',
      roleNames: [ROLES.MANAGER, ROLES.EMPLOYEE],
      managerScopeUnitCode: 'K_CNTT',
    },
    {
      email: 'lecturer.a@sgu.edu.vn',
      password: 'Employee@123',
      fullName: 'NGUYEN VAN A',
      employeeCode: 'VC-EMP-1001',
      citizenId: '079101000003',
      dob: '1990-01-15',
      gender: Gender.NAM,
      unitCode: 'BM_CNPM',
      roleNames: [ROLES.EMPLOYEE],
    },
    {
      email: 'lecturer.b@sgu.edu.vn',
      password: 'Employee@123',
      fullName: 'TRAN THI B',
      employeeCode: 'VC-EMP-1002',
      citizenId: '079101000004',
      dob: '1992-09-18',
      gender: Gender.NU,
      unitCode: 'BM_CNPM',
      roleNames: [ROLES.EMPLOYEE],
    },
  ];

  for (const account of linkedAccounts) {
    await upsertLinkedAccount(account);
  }

  console.log('[seed] leave types');
  const leaveTypes = [
    {
      code: 'PHEP_TRUONG',
      name: 'Nghi huong luong truong',
      category: LeaveCategory.PAID_SCHOOL,
      maxDays: 30,
      isPaid: true,
      seniorityCount: true,
      delaySalaryRaise: false,
    },
    {
      code: 'PHEP_BHXH',
      name: 'Nghi huong BHXH',
      category: LeaveCategory.PAID_BHXH,
      maxDays: 180,
      isPaid: true,
      seniorityCount: true,
      delaySalaryRaise: false,
    },
    {
      code: 'PHEP_KHONG_LUONG',
      name: 'Nghi khong luong',
      category: LeaveCategory.UNPAID,
      maxDays: 180,
      isPaid: false,
      seniorityCount: false,
      delaySalaryRaise: true,
    },
  ];

  for (const item of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  }

  // ─── Civil Servant Ranks (Ngạch/chức danh viên chức) ─────────

  console.log('[seed] seeding civil servant ranks...');

  const civilServantRanks = [
    // ── Giảng viên ĐH (TT 35/2020, sửa đổi TT 04/2022/TT-BGDĐT) ──
    { code: 'V.07.01.01', name: 'Giang vien cao cap (hang I)', rankType: 'Hang I', category: 'GV_DAI_HOC', rankGroup: RankGroup.A3_1, minCoefficient: 6.20, maxCoefficient: 8.00, legalReference: 'TT 35/2020, sua doi TT 04/2022/TT-BGDDT' },
    { code: 'V.07.01.02', name: 'Giang vien chinh (hang II)', rankType: 'Hang II', category: 'GV_DAI_HOC', rankGroup: RankGroup.A2_1, minCoefficient: 4.40, maxCoefficient: 6.78, legalReference: 'TT 35/2020, sua doi TT 04/2022/TT-BGDDT' },
    { code: 'V.07.01.03', name: 'Giảng viên (hạng III)', rankType: 'Hạng III', category: 'GV_DAI_HOC', rankGroup: RankGroup.A1, minCoefficient: 2.34, maxCoefficient: 4.98, legalReference: 'TT 35/2020, sửa đổi TT 04/2022/TT-BGDĐT' },
    { code: 'V.07.01.23', name: 'Trợ giảng (hạng III)', rankType: 'Hạng III', category: 'GV_DAI_HOC', rankGroup: RankGroup.A0, minCoefficient: 2.10, maxCoefficient: 4.89, legalReference: 'TT 35/2020, sửa đổi TT 04/2022/TT-BGDĐT' },

    // ── Giáo viên Mầm non (TT 01/2021/TT-BGDĐT) ──
    { code: 'V.07.02.24', name: 'Giao vien mam non hang I', rankType: 'Hang I', category: 'GV_MAM_NON', rankGroup: RankGroup.A2_2, minCoefficient: 4.00, maxCoefficient: 6.38, legalReference: 'TT 01/2021/TT-BGDDT' },
    { code: 'V.07.02.25', name: 'Giáo viên mầm non hạng II', rankType: 'Hạng II', category: 'GV_MAM_NON', rankGroup: RankGroup.A1, minCoefficient: 2.34, maxCoefficient: 4.98, legalReference: 'TT 01/2021/TT-BGDĐT' },
    { code: 'V.07.02.26', name: 'Giáo viên mầm non hạng III', rankType: 'Hạng III', category: 'GV_MAM_NON', rankGroup: RankGroup.A0, minCoefficient: 2.10, maxCoefficient: 4.89, legalReference: 'TT 01/2021/TT-BGDĐT' },

    // ── Giáo viên Tiểu học (TT 02/2021/TT-BGDĐT) ──
    { code: 'V.07.03.27', name: 'Giao vien tieu hoc hang I', rankType: 'Hang I', category: 'GV_TIEU_HOC', rankGroup: RankGroup.A2_2, minCoefficient: 4.00, maxCoefficient: 6.38, legalReference: 'TT 02/2021/TT-BGDDT' },
    { code: 'V.07.03.28', name: 'Giáo viên tiểu học hạng II', rankType: 'Hạng II', category: 'GV_TIEU_HOC', rankGroup: RankGroup.A1, minCoefficient: 2.34, maxCoefficient: 4.98, legalReference: 'TT 02/2021/TT-BGDĐT' },
    { code: 'V.07.03.29', name: 'Giáo viên tiểu học hạng III', rankType: 'Hạng III', category: 'GV_TIEU_HOC', rankGroup: RankGroup.A0, minCoefficient: 2.10, maxCoefficient: 4.89, legalReference: 'TT 02/2021/TT-BGDĐT' },

    // ── Giáo viên THCS (TT 03/2021/TT-BGDĐT) ──
    { code: 'V.07.04.30', name: 'Giao vien THCS hang I', rankType: 'Hang I', category: 'GV_THCS', rankGroup: RankGroup.A2_1, minCoefficient: 4.40, maxCoefficient: 6.78, legalReference: 'TT 03/2021/TT-BGDDT' },
    { code: 'V.07.04.31', name: 'Giáo viên THCS hạng II', rankType: 'Hạng II', category: 'GV_THCS', rankGroup: RankGroup.A1, minCoefficient: 2.34, maxCoefficient: 4.98, legalReference: 'TT 03/2021/TT-BGDĐT' },
    { code: 'V.07.04.32', name: 'Giáo viên THCS hạng III', rankType: 'Hạng III', category: 'GV_THCS', rankGroup: RankGroup.A0, minCoefficient: 2.10, maxCoefficient: 4.89, legalReference: 'TT 03/2021/TT-BGDĐT' },

    // ── Giáo viên THPT (TT 04/2021/TT-BGDĐT) ──
    { code: 'V.07.05.13', name: 'Giao vien THPT hang I', rankType: 'Hang I', category: 'GV_THPT', rankGroup: RankGroup.A2_1, minCoefficient: 4.40, maxCoefficient: 6.78, legalReference: 'TT 04/2021/TT-BGDDT' },
    { code: 'V.07.05.14', name: 'Giáo viên THPT hạng II', rankType: 'Hạng II', category: 'GV_THPT', rankGroup: RankGroup.A1, minCoefficient: 2.34, maxCoefficient: 4.98, legalReference: 'TT 04/2021/TT-BGDĐT' },
    { code: 'V.07.05.15', name: 'Giáo viên THPT hạng III', rankType: 'Hạng III', category: 'GV_THPT', rankGroup: RankGroup.A0, minCoefficient: 2.10, maxCoefficient: 4.89, legalReference: 'TT 04/2021/TT-BGDĐT' },

    // ── GDNN - Giảng viên (TT 07/2023/TT-BLĐTBXH) ──
    { code: 'V.09.02.01', name: 'Giang vien GDNN cao cap (hang I)', rankType: 'Hang I', category: 'GIANG_VIEN_GDNN', rankGroup: RankGroup.A3_1, minCoefficient: 6.20, maxCoefficient: 8.00, legalReference: 'TT 07/2023/TT-BLDTBXH' },
    { code: 'V.09.02.02', name: 'Giang vien GDNN chinh (hang II)', rankType: 'Hang II', category: 'GIANG_VIEN_GDNN', rankGroup: RankGroup.A2_1, minCoefficient: 4.40, maxCoefficient: 6.78, legalReference: 'TT 07/2023/TT-BLDTBXH' },
    { code: 'V.09.02.03', name: 'GV GDNN lý thuyết (hạng III)', rankType: 'Hạng III', category: 'GIANG_VIEN_GDNN', rankGroup: RankGroup.A1, minCoefficient: 2.34, maxCoefficient: 4.98, legalReference: 'TT 07/2023/TT-BLĐTBXH' },
    { code: 'V.09.02.04', name: 'GV GDNN thuc hanh (hang III)', rankType: 'Hang III', category: 'GIANG_VIEN_GDNN', rankGroup: RankGroup.A0, minCoefficient: 2.10, maxCoefficient: 4.89, legalReference: 'TT 07/2023/TT-BLDTBXH' },

    // ── GDNN - Giáo viên (TT 07/2023/TT-BLĐTBXH) ──
    { code: 'V.09.02.05', name: 'Giao vien GDNN cao cap (hang I)', rankType: 'Hang I', category: 'GIAO_VIEN_GDNN', rankGroup: RankGroup.A3_2, minCoefficient: 5.75, maxCoefficient: 7.55, legalReference: 'TT 07/2023/TT-BLDTBXH' },
    { code: 'V.09.02.06', name: 'Giao vien GDNN chinh (hang II)', rankType: 'Hang II', category: 'GIAO_VIEN_GDNN', rankGroup: RankGroup.A2_1, minCoefficient: 4.40, maxCoefficient: 6.78, legalReference: 'TT 07/2023/TT-BLDTBXH' },
    { code: 'V.09.02.07', name: 'GV GDNN lý thuyết (hạng III)', rankType: 'Hạng III', category: 'GIAO_VIEN_GDNN', rankGroup: RankGroup.A1, minCoefficient: 2.34, maxCoefficient: 4.98, legalReference: 'TT 07/2023/TT-BLĐTBXH' },
    { code: 'V.09.02.08', name: 'GV GDNN thuc hanh (hang III)', rankType: 'Hang III', category: 'GIAO_VIEN_GDNN', rankGroup: RankGroup.A0, minCoefficient: 2.10, maxCoefficient: 4.89, legalReference: 'TT 07/2023/TT-BLDTBXH' },
    { code: 'V.09.02.09', name: 'Giáo viên GDNN (hạng IV)', rankType: 'Hạng IV', category: 'GIAO_VIEN_GDNN', rankGroup: RankGroup.B, minCoefficient: 1.86, maxCoefficient: 4.06, legalReference: 'TT 07/2023/TT-BLĐTBXH' },

    // ── Viên chức hành chính ──
    { code: '01.002', name: 'Chuyen vien chinh', rankType: 'A2.1', category: 'HANH_CHINH', rankGroup: RankGroup.A2_1, minCoefficient: 4.40, maxCoefficient: 6.78, legalReference: 'Danh muc ma so vien chuc chung' },
    { code: '01.003', name: 'Chuyên viên', rankType: 'A1', category: 'HANH_CHINH', rankGroup: RankGroup.A1, minCoefficient: 2.34, maxCoefficient: 4.98, legalReference: 'Danh mục mã số viên chức chung' },
    { code: '01.004', name: 'Can su', rankType: 'B', category: 'HANH_CHINH', rankGroup: RankGroup.A0, minCoefficient: 2.10, maxCoefficient: 4.89, legalReference: 'Danh muc ma so vien chuc chung' },
    { code: '01.005', name: 'Nhan vien', rankType: 'B', category: 'HANH_CHINH', rankGroup: RankGroup.B, minCoefficient: 1.86, maxCoefficient: 4.06, legalReference: 'Danh muc ma so vien chuc chung' },
  ];

  for (const rank of civilServantRanks) {
    await prisma.civilServantRank.upsert({
      where: { code: rank.code },
      update: {
        name: rank.name,
        rankType: rank.rankType,
        category: rank.category,
        sectorGroup: deriveSectorGroup(rank.category),
        rankGroup: rank.rankGroup,
        minCoefficient: rank.minCoefficient,
        maxCoefficient: rank.maxCoefficient,
        legalReference: rank.legalReference,
        isActive: true,
      },
      create: {
        ...rank,
        sectorGroup: deriveSectorGroup(rank.category),
      },
    });
  }

  console.log(`[seed] seeded ${civilServantRanks.length} civil servant ranks`);

  const rankGroups = Object.keys(DEFAULT_GROUP_COEFFICIENTS) as RankGroup[];
  await prisma.civilServantRankStep.deleteMany({
    where: { rankGroup: { notIn: rankGroups } },
  });

  let totalRankSteps = 0;
  for (const rankGroup of rankGroups) {
    const coefficients = DEFAULT_GROUP_COEFFICIENTS[rankGroup];
    for (let index = 0; index < coefficients.length; index += 1) {
      await prisma.civilServantRankStep.upsert({
        where: {
          rankGroup_level: {
            rankGroup,
            level: index + 1,
          },
        },
        update: {
          coefficient: coefficients[index],
          isActive: true,
        },
        create: {
          rankGroup,
          level: index + 1,
          coefficient: coefficients[index],
          isActive: true,
        },
      });
      totalRankSteps += 1;
    }
  }

  console.log(`[seed] seeded ${totalRankSteps} civil servant rank steps`);

  console.log('[seed] done');
  console.log('');
  console.log('Test accounts:');
  console.log('  admin@sgu.edu.vn / Admin@123  (SUPER_ADMIN)');
  console.log('  hr@sgu.edu.vn / Hr@12345      (HR_ADMIN + EMPLOYEE, linked)');
  console.log('  manager.fit@sgu.edu.vn / Manager@123 (MANAGER + EMPLOYEE, linked)');
  console.log('  lecturer.a@sgu.edu.vn / Employee@123 (EMPLOYEE, linked)');
  console.log('  lecturer.b@sgu.edu.vn / Employee@123 (EMPLOYEE, linked)');
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

