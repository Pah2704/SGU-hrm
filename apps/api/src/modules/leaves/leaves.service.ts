import {
  ApprovalStatus,
  LeaveCategory,
  type Employee,
  type LeaveRequest,
  type LeaveType,
  type Prisma,
} from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUserPayload } from '../../auth/interfaces';
import { PERMISSIONS } from '../../common/constants';
import { PrismaService } from '../../prisma';
import {
  AuditService,
  type AuditActor,
  type AuditContext,
} from '../audit/audit.service';
import type {
  ApproveLeaveRequestDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  ListLeaveRequestsQueryDto,
  UpdateLeaveTypeDto,
} from './dto';

type EmployeeScopeInfo = Pick<Employee, 'id' | 'userId' | 'unitId'>;

const HR_ADMIN_ROLES = new Set(['HR_ADMIN', 'SUPER_ADMIN']);

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listLeaveTypes(user: CurrentUserPayload) {
    this.assertCanAccessLeaveTypes(user);

    return this.prisma.leaveType.findMany({
      orderBy: [{ name: 'asc' }],
    });
  }

  async createLeaveType(
    dto: CreateLeaveTypeDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    this.assertHrAdmin(actor);

    const policy = this.normalizeLeaveTypePolicy(
      dto.category,
      dto.isPaid,
      dto.seniorityCount,
      dto.delaySalaryRaise,
    );

    const leaveType = await this.prisma.leaveType.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category,
        maxDays: dto.maxDays,
        ...policy,
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'LEAVE',
      leaveType.id,
      'CREATE',
      this.withAuditMeta(
        {
          kind: 'LEAVE_TYPE',
          after: leaveType,
        },
        requestPath,
      ),
      context,
    );

    return leaveType;
  }

  async updateLeaveType(
    id: string,
    dto: UpdateLeaveTypeDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    this.assertHrAdmin(actor);

    const existing = await this.prisma.leaveType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Leave type #${id} not found`);
    }

    const nextCategory = dto.category ?? existing.category;
    const policy = this.normalizeLeaveTypePolicy(
      nextCategory,
      dto.isPaid ?? existing.isPaid,
      dto.seniorityCount ?? existing.seniorityCount,
      dto.delaySalaryRaise ?? existing.delaySalaryRaise,
    );

    const updated = await this.prisma.leaveType.update({
      where: { id },
      data: {
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        category: dto.category,
        maxDays: dto.maxDays,
        ...policy,
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'LEAVE',
      updated.id,
      'UPDATE',
      this.withAuditMeta(
        {
          kind: 'LEAVE_TYPE',
          before: existing,
          after: updated,
        },
        requestPath,
      ),
      context,
    );

    return updated;
  }

  async listEmployeeLeaveRequests(
    employeeId: string,
    query: ListLeaveRequestsQueryDto,
    user: CurrentUserPayload,
  ) {
    const employee = await this.getEmployeeScopeInfo(employeeId);
    await this.assertCanReadEmployeeLeaves(employee, user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LeaveRequestWhereInput = {
      employeeId,
      employee: {
        is: {
          deletedAt: null,
        },
      },
    };

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          leaveType: true,
          employee: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              unitId: true,
              unit: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listApprovalQueue(
    query: ListLeaveRequestsQueryDto,
    user: CurrentUserPayload,
  ) {
    this.assertCanReadLeaveQueue(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const employeeWhere: Prisma.EmployeeWhereInput = {
      deletedAt: null,
    };
    let employeeIdFilter = query.employeeId;

    if (this.hasPermission(user, PERMISSIONS.LEAVES_READ)) {
      if (query.unitId) {
        employeeWhere.unitId = query.unitId;
      }
    } else if (this.hasPermission(user, PERMISSIONS.LEAVES_READ_UNIT)) {
      if (!user.unitId) {
        throw new ForbiddenException(
          'Unit-scoped permission requires an assigned unit',
        );
      }

      const manageableUnitIds = await this.resolveUnitScopeIds(user.unitId);
      if (manageableUnitIds.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 1,
          },
        };
      }

      let allowedUnitIds = manageableUnitIds;
      if (query.unitId) {
        const manageableSet = new Set(manageableUnitIds);
        if (!manageableSet.has(query.unitId)) {
          return {
            data: [],
            meta: {
              total: 0,
              page,
              limit,
              totalPages: 1,
            },
          };
        }
        allowedUnitIds = [query.unitId];
      }

      employeeWhere.unitId = { in: allowedUnitIds };
    } else {
      const ownEmployee = await this.getEmployeeByUserId(user.userId);
      if (!ownEmployee) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 1,
          },
        };
      }

      employeeIdFilter = ownEmployee.id;
    }

    const where: Prisma.LeaveRequestWhereInput = {
      employee: {
        is: employeeWhere,
      },
      ...(query.status ? { status: query.status } : {}),
      ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          leaveType: true,
          employee: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              unitId: true,
              unit: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createLeaveRequest(
    employeeId: string,
    dto: CreateLeaveRequestDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const employee = await this.getEmployeeScopeInfo(employeeId);
    this.assertCanSubmitLeaveRequest(employee, actor);

    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: dto.leaveTypeId },
    });

    if (!leaveType) {
      throw new NotFoundException(`Leave type #${dto.leaveTypeId} not found`);
    }

    const startDate = this.parseAsDayStartUtc(dto.fromDate);
    const endDate = this.parseAsDayStartUtc(dto.toDate);
    if (endDate < startDate) {
      throw new BadRequestException(
        'toDate must be greater than or equal to fromDate',
      );
    }

    const totalDays = this.calculateInclusiveDays(startDate, endDate);
    if (leaveType.maxDays && totalDays > leaveType.maxDays) {
      throw new BadRequestException(
        `Total leave days (${totalDays}) exceeds maxDays (${leaveType.maxDays})`,
      );
    }

    const overlappingRequest = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: [ApprovalStatus.PENDING, ApprovalStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });

    if (overlappingRequest) {
      throw new ConflictException('Overlapping leave request already exists');
    }

    const created = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason: this.toOptionalTrim(dto.reason),
      },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            unitId: true,
            unit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'LEAVE',
      created.id,
      'CREATE',
      this.withAuditMeta(
        {
          kind: 'LEAVE_REQUEST',
          after: {
            employeeId: created.employeeId,
            leaveTypeId: created.leaveTypeId,
            startDate: created.startDate.toISOString(),
            endDate: created.endDate.toISOString(),
            totalDays: created.totalDays,
            status: created.status,
          },
        },
        requestPath,
      ),
      context,
    );

    return created;
  }

  async approveLeaveRequest(
    id: string,
    dto: ApproveLeaveRequestDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    this.assertCanApproveLeaveRequests(actor);

    const existing = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            unitId: true,
          },
        },
        leaveType: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Leave request #${id} not found`);
    }

    await this.assertCanApproveTargetRequest(existing, actor);

    if (existing.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        'Only pending leave requests can be approved/rejected',
      );
    }

    const hrApproval = this.isHrAdmin(actor);
    const approvedAt = new Date();

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        approvedBy: actor.userId,
        approvedAt,
        notes: this.toOptionalTrim(dto.note),
        hrConfirmedBy:
          hrApproval && dto.status === ApprovalStatus.APPROVED
            ? actor.userId
            : existing.hrConfirmedBy,
        hrConfirmedAt:
          hrApproval && dto.status === ApprovalStatus.APPROVED
            ? approvedAt
            : existing.hrConfirmedAt,
      },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            unitId: true,
            unit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'LEAVE',
      updated.id,
      dto.status === ApprovalStatus.APPROVED ? 'APPROVE' : 'REJECT',
      this.withAuditMeta(
        {
          kind: 'LEAVE_REQUEST',
          before: {
            status: existing.status,
            approvedBy: existing.approvedBy,
            approvedAt: this.toIsoOrNull(existing.approvedAt),
            hrConfirmedBy: existing.hrConfirmedBy,
            hrConfirmedAt: this.toIsoOrNull(existing.hrConfirmedAt),
          },
          after: {
            status: updated.status,
            approvedBy: updated.approvedBy,
            approvedAt: this.toIsoOrNull(updated.approvedAt),
            hrConfirmedBy: updated.hrConfirmedBy,
            hrConfirmedAt: this.toIsoOrNull(updated.hrConfirmedAt),
          },
        },
        requestPath,
      ),
      context,
    );

    if (
      updated.status === ApprovalStatus.APPROVED &&
      updated.leaveType.category === LeaveCategory.UNPAID
    ) {
      await this.emitSalaryImpactForUnpaidLeave(updated, actor, requestPath);
    }

    return updated;
  }

  private normalizeLeaveTypePolicy(
    category: LeaveCategory,
    isPaid: boolean | undefined,
    seniorityCount: boolean | undefined,
    delaySalaryRaise: boolean | undefined,
  ): Pick<LeaveType, 'isPaid' | 'seniorityCount' | 'delaySalaryRaise'> {
    const normalizedIsPaid =
      category === LeaveCategory.UNPAID ? false : (isPaid ?? true);

    const normalizedSeniorityCount =
      category === LeaveCategory.UNPAID ? false : (seniorityCount ?? true);

    const normalizedDelaySalaryRaise =
      category === LeaveCategory.UNPAID
        ? (delaySalaryRaise ?? true)
        : (delaySalaryRaise ?? false);

    return {
      isPaid: normalizedIsPaid,
      seniorityCount: normalizedSeniorityCount,
      delaySalaryRaise: normalizedDelaySalaryRaise,
    };
  }

  private async getEmployeeScopeInfo(employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        unitId: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found`);
    }

    return employee;
  }

  private async getEmployeeByUserId(userId: string) {
    return this.prisma.employee.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        unitId: true,
      },
    });
  }

  private assertCanAccessLeaveTypes(user: CurrentUserPayload): void {
    const canAccess = this.hasAnyPermission(user, [
      PERMISSIONS.LEAVES_READ,
      PERMISSIONS.LEAVES_READ_UNIT,
      PERMISSIONS.LEAVES_READ_OWN,
      PERMISSIONS.LEAVES_WRITE,
      PERMISSIONS.LEAVES_APPROVE,
    ]);

    if (!canAccess) {
      throw new ForbiddenException(
        'Insufficient permissions to access leave types',
      );
    }
  }

  private async assertCanReadEmployeeLeaves(
    employee: EmployeeScopeInfo,
    user: CurrentUserPayload,
  ) {
    if (this.hasPermission(user, PERMISSIONS.LEAVES_READ)) {
      return;
    }

    if (
      this.hasPermission(user, PERMISSIONS.LEAVES_READ_OWN) &&
      employee.userId === user.userId
    ) {
      return;
    }

    if (this.hasPermission(user, PERMISSIONS.LEAVES_READ_UNIT)) {
      if (!user.unitId) {
        throw new ForbiddenException(
          'Unit-scoped permission requires an assigned unit',
        );
      }

      const manageableUnitIds = await this.resolveUnitScopeIds(user.unitId);
      if (manageableUnitIds.includes(employee.unitId)) {
        return;
      }
    }

    throw new ForbiddenException(
      'You are not allowed to read this leave request list',
    );
  }

  private assertCanSubmitLeaveRequest(
    employee: EmployeeScopeInfo,
    user: CurrentUserPayload,
  ) {
    if (
      this.hasPermission(user, PERMISSIONS.LEAVES_WRITE) &&
      employee.userId === user.userId
    ) {
      return;
    }

    if (
      this.isHrAdmin(user) &&
      this.hasPermission(user, PERMISSIONS.LEAVES_APPROVE)
    ) {
      return;
    }

    throw new ForbiddenException(
      'You can only submit leave requests for your own employee profile',
    );
  }

  private assertCanReadLeaveQueue(user: CurrentUserPayload) {
    const canReadQueue = this.hasAnyPermission(user, [
      PERMISSIONS.LEAVES_READ,
      PERMISSIONS.LEAVES_READ_UNIT,
      PERMISSIONS.LEAVES_READ_OWN,
      PERMISSIONS.LEAVES_APPROVE,
    ]);

    if (!canReadQueue) {
      throw new ForbiddenException(
        'Insufficient permissions to access leave queue',
      );
    }
  }

  private assertCanApproveLeaveRequests(user: CurrentUserPayload) {
    if (this.hasPermission(user, PERMISSIONS.LEAVES_APPROVE)) {
      return;
    }

    throw new ForbiddenException(
      'Insufficient permissions. Missing: leaves:approve',
    );
  }

  private async assertCanApproveTargetRequest(
    leaveRequest: LeaveRequest & { employee: EmployeeScopeInfo },
    user: CurrentUserPayload,
  ) {
    if (
      this.hasPermission(user, PERMISSIONS.LEAVES_READ) ||
      this.isHrAdmin(user)
    ) {
      return;
    }

    if (!user.unitId) {
      throw new ForbiddenException(
        'Unit-scoped approval requires an assigned unit',
      );
    }

    const manageableUnitIds = await this.resolveUnitScopeIds(user.unitId);
    if (!manageableUnitIds.includes(leaveRequest.employee.unitId)) {
      throw new ForbiddenException(
        'You cannot approve leave requests outside your managed unit',
      );
    }
  }

  private assertHrAdmin(user: CurrentUserPayload) {
    if (this.isHrAdmin(user)) {
      return;
    }

    throw new ForbiddenException(
      'Only HR Admin or Super Admin can manage leave types',
    );
  }

  private isHrAdmin(user: CurrentUserPayload): boolean {
    return user.roles.some((roleName) => HR_ADMIN_ROLES.has(roleName));
  }

  private hasPermission(user: CurrentUserPayload, permission: string): boolean {
    return user.permissions.includes(permission);
  }

  private hasAnyPermission(
    user: CurrentUserPayload,
    permissions: string[],
  ): boolean {
    return permissions.some((permission) =>
      this.hasPermission(user, permission),
    );
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

  private parseAsDayStartUtc(value: string): Date {
    const day = value.slice(0, 10);
    const parsed = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date value: ${value}`);
    }
    return parsed;
  }

  private calculateInclusiveDays(fromDate: Date, toDate: Date): number {
    const millisPerDay = 24 * 60 * 60 * 1000;
    return (
      Math.floor((toDate.getTime() - fromDate.getTime()) / millisPerDay) + 1
    );
  }

  private async emitSalaryImpactForUnpaidLeave(
    leaveRequest: LeaveRequest & { leaveType: LeaveType },
    actor: CurrentUserPayload,
    requestPath?: string,
  ) {
    const payload = {
      event: 'UNPAID_LEAVE_APPROVED',
      leaveRequestId: leaveRequest.id,
      employeeId: leaveRequest.employeeId,
      leaveTypeId: leaveRequest.leaveTypeId,
      fromDate: leaveRequest.startDate.toISOString(),
      toDate: leaveRequest.endDate.toISOString(),
      totalDays: leaveRequest.totalDays,
      delaySalaryRaise: leaveRequest.leaveType.delaySalaryRaise,
      seniorityCount: leaveRequest.leaveType.seniorityCount,
    };

    this.logger.log(
      `[SalaryImpactStub] TODO publish unpaid leave event: ${JSON.stringify(payload)}`,
    );

    await this.auditService.record(
      this.toAuditActor(actor),
      'LEAVE',
      leaveRequest.id,
      'UPDATE',
      this.withAuditMeta(
        {
          kind: 'SALARY_IMPACT_STUB',
          payload,
        },
        requestPath,
      ),
    );
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

  private toOptionalTrim(value?: string | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private toIsoOrNull(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
  }
}
