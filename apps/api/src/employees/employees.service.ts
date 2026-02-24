import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { EmployeeStatus, Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/interfaces';
import { PERMISSIONS } from '../common/constants';
import {
  AuditService,
  type AuditActor,
  type AuditContext,
} from '../modules/audit/audit.service';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(
    createEmployeeDto: CreateEmployeeDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const { email, citizenId, employeeCode } = createEmployeeDto;
    if (!email) {
      throw new BadRequestException('Email is required to create employee');
    }

    // 1. Check uniqueness for Critical Fields
    const existing = await this.prisma.employee.findFirst({
      where: {
        OR: [{ employeeCode }, { citizenId }, { email }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'Employee with this Code, Citizen ID, or Email already exists',
      );
    }

    // 2. Prepare User creation if email is present
    let userId: string;

    // Hash password (default to citizenId)
    // Note: In a real app, send welcome email with set-password link
    const saltRounds = 10;
    const defaultPassword = citizenId;
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

    const createdEmployee = await this.prisma.$transaction(async (tx) => {
      // Create User if email provided
      // Check if user exists (could be a guest user without employee profile)
      const existingUser = await tx.user.findUnique({
        where: { email },
        include: { employee: { select: { id: true } } },
      });

      if (existingUser) {
        if (existingUser.employee) {
          throw new ConflictException(
            'User already linked to another employee',
          );
        }
        userId = existingUser.id;
      } else {
        const newUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            isActive: true,
            roles: {
              create: {
                role: { connect: { name: 'EMPLOYEE' } },
              },
            },
          },
        });
        userId = newUser.id;
      }

      // 3. Create Employee
      return tx.employee.create({
        data: {
          ...createEmployeeDto,
          dob: new Date(createEmployeeDto.dob),
          citizenCardDate: createEmployeeDto.citizenCardDate
            ? new Date(createEmployeeDto.citizenCardDate)
            : null,
          initialRecruitmentDate: createEmployeeDto.initialRecruitmentDate
            ? new Date(createEmployeeDto.initialRecruitmentDate)
            : null,
          currentOrgJoinDate: createEmployeeDto.currentOrgJoinDate
            ? new Date(createEmployeeDto.currentOrgJoinDate)
            : null,
          officialDate: createEmployeeDto.officialDate
            ? new Date(createEmployeeDto.officialDate)
            : null,
          userId, // Link if created
        },
      });
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'EMPLOYEE',
      createdEmployee.id,
      'CREATE',
      this.withAuditMeta(
        {
          after: {
            employeeCode: createdEmployee.employeeCode,
            fullName: createdEmployee.fullName,
            unitId: createdEmployee.unitId,
            status: createdEmployee.status,
          },
        },
        requestPath,
      ),
      context,
    );

    return createdEmployee;
  }

  async findAll(query: EmployeeQueryDto, user: CurrentUserPayload) {
    const { page = '1', limit = '10', search, unitId, status } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const readAll = this.hasPermission(user, PERMISSIONS.EMPLOYEES_READ);
    const readUnit = this.hasPermission(user, PERMISSIONS.EMPLOYEES_READ_UNIT);
    const readOwn = this.hasPermission(user, PERMISSIONS.EMPLOYEES_READ_OWN);

    if (!readAll && !readUnit && !readOwn) {
      throw new ForbiddenException(
        'Insufficient permissions to read employees',
      );
    }

    const where: Prisma.EmployeeWhereInput = { deletedAt: null };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (readAll) {
      if (unitId) {
        const scopedUnitIds = await this.resolveUnitScopeIds(unitId);
        if (scopedUnitIds.length === 0) {
          return { data: [], total: 0, page: Number(page), limit: take };
        }
        where.unitId = { in: scopedUnitIds };
      }
    } else if (readUnit) {
      if (!user.unitId) {
        throw new ForbiddenException(
          'Unit-scoped permission requires an assigned unit',
        );
      }

      const manageableUnitIds = await this.resolveUnitScopeIds(user.unitId);
      if (manageableUnitIds.length === 0) {
        return { data: [], total: 0, page: Number(page), limit: take };
      }

      if (unitId) {
        const requestedUnitIds = await this.resolveUnitScopeIds(unitId);
        const manageableSet = new Set(manageableUnitIds);
        const intersectedUnitIds = requestedUnitIds.filter((id) =>
          manageableSet.has(id),
        );

        if (intersectedUnitIds.length === 0) {
          return { data: [], total: 0, page: Number(page), limit: take };
        }

        where.unitId = { in: intersectedUnitIds };
      } else {
        where.unitId = { in: manageableUnitIds };
      }
    } else {
      where.userId = user.userId;
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take,
        include: { unit: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { data, total, page: Number(page), limit: take };
  }

  async findOne(id: string, user: CurrentUserPayload) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        unit: true,
        relationships: true,
        contracts: true, // Optional: verify security policy for reading detailed relations
      },
    });
    if (!employee) throw new NotFoundException(`Employee #${id} not found`);

    if (this.hasPermission(user, PERMISSIONS.EMPLOYEES_READ)) {
      return employee;
    }

    if (
      this.hasPermission(user, PERMISSIONS.EMPLOYEES_READ_OWN) &&
      employee.userId === user.userId
    ) {
      return employee;
    }

    if (this.hasPermission(user, PERMISSIONS.EMPLOYEES_READ_UNIT)) {
      if (!user.unitId) {
        throw new ForbiddenException(
          'Unit-scoped permission requires an assigned unit',
        );
      }

      const manageableUnitIds = await this.resolveUnitScopeIds(user.unitId);
      if (manageableUnitIds.includes(employee.unitId)) {
        return employee;
      }
    }

    throw new ForbiddenException('You are not allowed to access this employee');
  }

  private async ensureNotSoftDeleted(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${id} not found`);
    }

    return employee;
  }

  async update(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    // Check exist
    await this.ensureNotSoftDeleted(id);
    const before = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        unitId: true,
        status: true,
        email: true,
        phone: true,
        currentPosition: true,
      },
    });

    const {
      dob,
      citizenCardDate,
      initialRecruitmentDate,
      currentOrgJoinDate,
      officialDate,
      ...rest
    } = updateEmployeeDto;

    const data: Prisma.EmployeeUpdateInput = {
      ...rest,
    };

    if (dob) {
      data.dob = new Date(dob);
    }
    if (citizenCardDate) {
      data.citizenCardDate = new Date(citizenCardDate);
    }
    if (initialRecruitmentDate) {
      data.initialRecruitmentDate = new Date(initialRecruitmentDate);
    }
    if (currentOrgJoinDate) {
      data.currentOrgJoinDate = new Date(currentOrgJoinDate);
    }
    if (officialDate) {
      data.officialDate = new Date(officialDate);
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data,
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'EMPLOYEE',
      updated.id,
      'UPDATE',
      this.withAuditMeta(
        {
          before: before
            ? {
                employeeCode: before.employeeCode,
                fullName: before.fullName,
                unitId: before.unitId,
                status: before.status,
                email: before.email,
                phone: before.phone,
                currentPosition: before.currentPosition,
              }
            : null,
          after: {
            employeeCode: updated.employeeCode,
            fullName: updated.fullName,
            unitId: updated.unitId,
            status: updated.status,
            email: updated.email,
            phone: updated.phone,
            currentPosition: updated.currentPosition,
          },
        },
        requestPath,
      ),
      context,
    );

    return updated;
  }

  async updateStatus(
    id: string,
    status: EmployeeStatus,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    await this.ensureNotSoftDeleted(id);
    const before = await this.prisma.employee.findUnique({
      where: { id },
      select: { status: true },
    });

    const updated = await this.prisma.employee.update({
      where: { id },
      data: { status },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'EMPLOYEE',
      id,
      'STATUS_CHANGE',
      this.withAuditMeta(
        {
          statusFrom: before?.status ?? null,
          statusTo: updated.status,
        },
        requestPath,
      ),
      context,
    );

    return updated;
  }

  async remove(
    id: string,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${id} not found`);
    }

    if (employee.deletedAt) {
      throw new BadRequestException(`Employee #${id} has already been deleted`);
    }

    const softDeleted = await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'EMPLOYEE',
      id,
      'SOFT_DELETE',
      this.withAuditMeta(
        {
          before: { deletedAt: this.toIsoOrNull(employee.deletedAt) },
          after: { deletedAt: this.toIsoOrNull(softDeleted.deletedAt) },
        },
        requestPath,
      ),
      context,
    );

    return softDeleted;
  }

  private hasPermission(user: CurrentUserPayload, permission: string): boolean {
    return user.permissions.includes(permission);
  }

  private async resolveUnitScopeIds(rootUnitId: string): Promise<string[]> {
    const rootUnit = await this.prisma.unit.findUnique({
      where: { id: rootUnitId },
      select: { id: true, path: true, isDeleted: true },
    });

    if (!rootUnit || rootUnit.isDeleted) {
      return [];
    }

    if (!rootUnit.path) {
      return [rootUnit.id];
    }

    const units = await this.prisma.unit.findMany({
      where: {
        isDeleted: false,
        OR: [
          { id: rootUnit.id },
          { path: { startsWith: `${rootUnit.path}.` } },
        ],
      },
      select: { id: true },
    });

    return units.map((unit) => unit.id);
  }

  private toAuditActor(actor?: CurrentUserPayload): AuditActor | undefined {
    if (!actor) {
      return undefined;
    }

    return {
      userId: actor.userId,
      roles: actor.roles,
    };
  }

  private withAuditMeta(
    changes: Record<string, unknown>,
    requestPath?: string,
  ): Prisma.InputJsonValue {
    if (!requestPath) {
      return changes as Prisma.InputJsonValue;
    }

    return {
      ...changes,
      meta: {
        path: requestPath,
      },
    } as Prisma.InputJsonValue;
  }

  private toIsoOrNull(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
  }
}
