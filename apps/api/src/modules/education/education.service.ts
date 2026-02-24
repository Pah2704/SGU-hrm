import {
  ApprovalStatus,
  DegreeType,
  type Prisma,
  type Employee,
} from '@prisma/client';
import {
  ForbiddenException,
  Injectable,
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
  ApproveCertificateDto,
  ApproveDegreeDto,
  CreateCertificateDto,
  CreateDegreeDto,
} from './dto';

type EmployeeScopeInfo = Pick<Employee, 'id' | 'userId' | 'unitId'>;
type PrismaLikeClient = PrismaService | Prisma.TransactionClient;

type HighestDegreeChange = {
  before: string | null;
  after: string | null;
  changed: boolean;
};

const DEGREE_PRIORITY: Record<DegreeType, number> = {
  TRUNG_CAP: 1,
  CAO_DANG: 2,
  DAI_HOC: 3,
  THAC_SI: 4,
  TIEN_SI: 5,
};

@Injectable()
export class EducationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listDegrees(employeeId: string, user: CurrentUserPayload) {
    const employee = await this.getEmployeeScopeInfo(employeeId);
    await this.assertCanReadEmployee(employee, user);

    return this.prisma.degree.findMany({
      where: { employeeId },
      orderBy: [{ graduationYear: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createDegree(
    employeeId: string,
    dto: CreateDegreeDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const employee = await this.getEmployeeScopeInfo(employeeId);
    this.assertCanWriteEmployee(employee, actor);

    const canApprove = this.hasPermission(actor, PERMISSIONS.EDUCATION_APPROVE);
    const status =
      canApprove && dto.status ? dto.status : ApprovalStatus.PENDING;

    const { degree, highestDegreeChange } = await this.prisma.$transaction(
      async (tx) => {
        const createdDegree = await tx.degree.create({
          data: {
            employeeId,
            degreeType: dto.degreeType,
            major: dto.major.trim(),
            institution: dto.institution.trim(),
            graduationYear: dto.graduationYear,
            degreeNumber: this.toOptionalTrim(dto.degreeNumber),
            fileUrl: this.toOptionalTrim(dto.fileUrl),
            status,
            approvedBy:
              status === ApprovalStatus.APPROVED ? actor.userId : undefined,
            approvedAt:
              status === ApprovalStatus.APPROVED ? new Date() : undefined,
          },
        });

        const nextHighestDegree =
          status === ApprovalStatus.APPROVED
            ? await this.syncHighestDegree(employeeId, tx)
            : null;

        return {
          degree: createdDegree,
          highestDegreeChange: nextHighestDegree,
        };
      },
    );

    await this.auditService.record(
      this.toAuditActor(actor),
      'DEGREE',
      degree.id,
      'CREATE',
      this.withAuditMeta(
        {
          after: {
            employeeId: degree.employeeId,
            degreeType: degree.degreeType,
            major: degree.major,
            institution: degree.institution,
            graduationYear: degree.graduationYear,
            status: degree.status,
          },
        },
        requestPath,
      ),
      context,
    );

    await this.recordHighestDegreeAuditIfChanged(
      employeeId,
      highestDegreeChange,
      actor,
      context,
      requestPath,
    );

    return degree;
  }

  async approveDegree(
    degreeId: string,
    dto: ApproveDegreeDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    this.assertCanApprove(actor);

    const existingDegree = await this.prisma.degree.findUnique({
      where: { id: degreeId },
    });

    if (!existingDegree) {
      throw new NotFoundException(`Degree #${degreeId} not found`);
    }

    const { degree, highestDegreeChange } = await this.prisma.$transaction(
      async (tx) => {
        const updatedDegree = await tx.degree.update({
          where: { id: degreeId },
          data: {
            status: dto.status,
            approvedBy:
              dto.status === ApprovalStatus.APPROVED ? actor.userId : null,
            approvedAt:
              dto.status === ApprovalStatus.APPROVED ? new Date() : null,
          },
        });

        const nextHighestDegree = await this.syncHighestDegree(
          updatedDegree.employeeId,
          tx,
        );

        return {
          degree: updatedDegree,
          highestDegreeChange: nextHighestDegree,
        };
      },
    );

    await this.auditService.record(
      this.toAuditActor(actor),
      'DEGREE',
      degree.id,
      dto.status === ApprovalStatus.APPROVED ? 'APPROVE' : 'REJECT',
      this.withAuditMeta(
        {
          before: {
            status: existingDegree.status,
            approvedBy: existingDegree.approvedBy,
            approvedAt: this.toIsoOrNull(existingDegree.approvedAt),
          },
          after: {
            status: degree.status,
            approvedBy: degree.approvedBy,
            approvedAt: this.toIsoOrNull(degree.approvedAt),
          },
        },
        requestPath,
      ),
      context,
    );

    await this.recordHighestDegreeAuditIfChanged(
      degree.employeeId,
      highestDegreeChange,
      actor,
      context,
      requestPath,
    );

    return degree;
  }

  async listCertificates(employeeId: string, user: CurrentUserPayload) {
    const employee = await this.getEmployeeScopeInfo(employeeId);
    await this.assertCanReadEmployee(employee, user);

    return this.prisma.certificate.findMany({
      where: { employeeId },
      orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createCertificate(
    employeeId: string,
    dto: CreateCertificateDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const employee = await this.getEmployeeScopeInfo(employeeId);
    this.assertCanWriteEmployee(employee, actor);

    const canApprove = this.hasPermission(actor, PERMISSIONS.EDUCATION_APPROVE);
    const status =
      canApprove && dto.status ? dto.status : ApprovalStatus.PENDING;

    const certificate = await this.prisma.certificate.create({
      data: {
        employeeId,
        name: dto.name.trim(),
        issuedBy: dto.issuedBy.trim(),
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        fileUrl: this.toOptionalTrim(dto.fileUrl),
        status,
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'CERTIFICATE',
      certificate.id,
      'CREATE',
      this.withAuditMeta(
        {
          after: {
            employeeId: certificate.employeeId,
            name: certificate.name,
            issuedBy: certificate.issuedBy,
            status: certificate.status,
          },
        },
        requestPath,
      ),
      context,
    );

    return certificate;
  }

  async approveCertificate(
    certificateId: string,
    dto: ApproveCertificateDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    this.assertCanApprove(actor);

    const existingCertificate = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!existingCertificate) {
      throw new NotFoundException(`Certificate #${certificateId} not found`);
    }

    const certificate = await this.prisma.certificate.update({
      where: { id: certificateId },
      data: { status: dto.status },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'CERTIFICATE',
      certificate.id,
      dto.status === ApprovalStatus.APPROVED ? 'APPROVE' : 'REJECT',
      this.withAuditMeta(
        {
          before: {
            status: existingCertificate.status,
          },
          after: {
            status: certificate.status,
          },
        },
        requestPath,
      ),
      context,
    );

    return certificate;
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

  private async assertCanReadEmployee(
    employee: EmployeeScopeInfo,
    user: CurrentUserPayload,
  ) {
    if (
      this.hasAnyPermission(user, [
        PERMISSIONS.EMPLOYEES_READ,
        PERMISSIONS.EDUCATION_APPROVE,
      ])
    ) {
      return;
    }

    if (this.hasPermission(user, PERMISSIONS.EMPLOYEES_READ_UNIT)) {
      if (!user.unitId) {
        throw new ForbiddenException(
          'Unit-scoped permission requires an assigned unit',
        );
      }

      const scopedUnitIds = await this.resolveUnitScopeIds(user.unitId);
      if (scopedUnitIds.includes(employee.unitId)) {
        return;
      }
    }

    const isOwnRecord = employee.userId === user.userId;
    if (
      isOwnRecord &&
      this.hasAnyPermission(user, [
        PERMISSIONS.EDUCATION_READ,
        PERMISSIONS.EDUCATION_WRITE,
        PERMISSIONS.EMPLOYEES_READ_OWN,
      ])
    ) {
      return;
    }

    throw new ForbiddenException('You are not allowed to access this employee');
  }

  private assertCanWriteEmployee(
    employee: EmployeeScopeInfo,
    user: CurrentUserPayload,
  ) {
    if (
      this.hasAnyPermission(user, [
        PERMISSIONS.EMPLOYEES_WRITE,
        PERMISSIONS.EDUCATION_APPROVE,
      ])
    ) {
      return;
    }

    if (
      employee.userId === user.userId &&
      this.hasPermission(user, PERMISSIONS.EDUCATION_WRITE)
    ) {
      return;
    }

    throw new ForbiddenException(
      'You are not allowed to update education data',
    );
  }

  private assertCanApprove(user: CurrentUserPayload) {
    if (this.hasPermission(user, PERMISSIONS.EDUCATION_APPROVE)) {
      return;
    }

    throw new ForbiddenException(
      'Insufficient permissions. Missing: education:approve',
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

  private async syncHighestDegree(
    employeeId: string,
    db: PrismaLikeClient,
  ): Promise<HighestDegreeChange> {
    const approvedDegrees = await db.degree.findMany({
      where: {
        employeeId,
        status: ApprovalStatus.APPROVED,
      },
      select: {
        degreeType: true,
        graduationYear: true,
        createdAt: true,
      },
    });

    let nextHighestDegree: DegreeType | null = null;
    let bestRank = -1;
    let bestYear = -1;
    let bestCreatedAt = -1;

    for (const degree of approvedDegrees) {
      const rank = DEGREE_PRIORITY[degree.degreeType];
      const graduationYear = degree.graduationYear;
      const createdAtMillis = degree.createdAt.getTime();

      const shouldReplace =
        rank > bestRank ||
        (rank === bestRank && graduationYear > bestYear) ||
        (rank === bestRank &&
          graduationYear === bestYear &&
          createdAtMillis > bestCreatedAt);

      if (shouldReplace) {
        nextHighestDegree = degree.degreeType;
        bestRank = rank;
        bestYear = graduationYear;
        bestCreatedAt = createdAtMillis;
      }
    }

    const currentEmployee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { highestDegree: true },
    });

    if (!currentEmployee) {
      return {
        before: null,
        after: nextHighestDegree,
        changed: false,
      };
    }

    const before = currentEmployee.highestDegree;
    const after = nextHighestDegree;

    if (before === after) {
      return {
        before,
        after,
        changed: false,
      };
    }

    await db.employee.update({
      where: { id: employeeId },
      data: {
        highestDegree: after,
      },
    });

    return {
      before,
      after,
      changed: true,
    };
  }

  private async recordHighestDegreeAuditIfChanged(
    employeeId: string,
    highestDegreeChange: HighestDegreeChange | null,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    if (!highestDegreeChange?.changed) {
      return;
    }

    await this.auditService.record(
      this.toAuditActor(actor),
      'EMPLOYEE',
      employeeId,
      'UPDATE',
      this.withAuditMeta(
        {
          before: {
            highestDegree: highestDegreeChange.before,
          },
          after: {
            highestDegree: highestDegreeChange.after,
          },
        },
        requestPath,
      ),
      context,
    );
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

  private toAuditActor(actor: CurrentUserPayload): AuditActor {
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

  private toOptionalTrim(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private toIsoOrNull(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }
}
