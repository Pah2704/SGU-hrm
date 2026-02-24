import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type RankGroup } from '@prisma/client';
import type { CurrentUserPayload } from '../../auth/interfaces';
import {
  PERMISSIONS,
  VALID_SECTOR_GROUPS,
  deriveSectorGroup,
  isValidSectorGroup,
  normalizeSectorGroup,
  type SectorGroup,
} from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditService,
  type AuditActor,
  type AuditContext,
} from '../audit/audit.service';
import type {
  CreateRankDto,
  CreateRankStepDto,
  CreateSalaryRecordDto,
  UpdateRankDto,
  UpdateRankStepDto,
} from './dto';

/** Raise cycle in months based on RankGroup */
const RAISE_CYCLE_MONTHS: Record<RankGroup, number> = {
  A0: 36,
  A1: 36,
  A2_1: 36,
  A2_2: 36,
  A3_1: 36,
  A3_2: 36,
  B: 24,
};

interface EmployeeScopeInfo {
  id: string;
  unitId: string | null;
}

type DataMeta<T> = {
  data: T;
  meta: Record<string, unknown>;
};

@Injectable()
export class SalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // -- Master Data -----------------------------------------------------------

  async findAllRanks(query?: {
    active?: string;
    search?: string;
    category?: string;
    sectorGroup?: string;
  }) {
    const where: Prisma.CivilServantRankWhereInput = {};

    if (query?.active === 'true') {
      where.isActive = true;
    } else if (query?.active === 'false') {
      where.isActive = false;
    }

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.sectorGroup) {
      where.sectorGroup = this.validateSectorGroup(query.sectorGroup);
    }

    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const ranks = await this.prisma.civilServantRank.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { code: 'asc' }],
    });

    return ranks.map((rank) => this.normalizeRank(rank));
  }

  async findDistinctSectors(): Promise<SectorGroup[]> {
    const results = await this.prisma.civilServantRank.findMany({
      where: {
        sectorGroup: { in: [...VALID_SECTOR_GROUPS] },
      },
      distinct: ['sectorGroup'],
      select: { sectorGroup: true },
      orderBy: { sectorGroup: 'asc' },
    });

    return results
      .map((item) => item.sectorGroup)
      .filter(
        (value): value is SectorGroup =>
          typeof value === 'string' && isValidSectorGroup(value),
      );
  }

  async createRank(
    dto: CreateRankDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ): Promise<DataMeta<Record<string, unknown>>> {
    const sectorGroup = deriveSectorGroup(dto.category);

    const created = await this.prisma.civilServantRank.create({
      data: {
        code: dto.code,
        name: dto.name,
        rankType: dto.rankType ?? null,
        category: dto.category ?? null,
        sectorGroup,
        rankGroup: dto.rankGroup,
        minCoefficient: dto.minCoefficient ?? null,
        maxCoefficient: dto.maxCoefficient ?? null,
        isActive: dto.isActive ?? true,
        legalReference: dto.legalReference ?? null,
        replacedByCode: dto.replacedByCode ?? null,
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'SALARY',
      created.id,
      'CREATE',
      this.withAuditMeta(
        {
          code: created.code,
          rankGroup: created.rankGroup,
          isActive: created.isActive,
        },
        requestPath,
      ),
      context ?? undefined,
    );

    return { data: this.normalizeRank(created), meta: {} };
  }

  async updateRank(
    id: string,
    dto: UpdateRankDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ): Promise<DataMeta<Record<string, unknown>>> {
    const existing = await this.prisma.civilServantRank.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Ngach/chuc danh khong ton tai.');
    }

    const nextSectorGroup =
      dto.category !== undefined ? deriveSectorGroup(dto.category) : undefined;

    const updated = await this.prisma.civilServantRank.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        rankType: dto.rankType,
        category: dto.category,
        sectorGroup: nextSectorGroup,
        rankGroup: dto.rankGroup,
        minCoefficient: dto.minCoefficient,
        maxCoefficient: dto.maxCoefficient,
        isActive: dto.isActive,
        legalReference: dto.legalReference,
        replacedByCode: dto.replacedByCode,
      },
    });

    const activeSalaryRecordCount =
      dto.isActive === false && existing.isActive
        ? await this.prisma.salaryRecord.count({
            where: {
              civilServantRankId: id,
              effectiveTo: null,
            },
          })
        : 0;

    const warnings =
      activeSalaryRecordCount > 0
        ? [
            `Co ${activeSalaryRecordCount} ho so luong dang hieu luc dang tham chieu ngach nay.`,
            'Ngach da vo hieu hoa van duoc giu de tra cuu lich su, nhung se bi chan cho quyet dinh moi.',
          ]
        : [];

    await this.auditService.record(
      this.toAuditActor(actor),
      'SALARY',
      updated.id,
      'UPDATE',
      this.withAuditMeta(
        {
          before: this.normalizeRank(existing),
          after: this.normalizeRank(updated),
          warnings,
        },
        requestPath,
      ),
      context ?? undefined,
    );

    return {
      data: this.normalizeRank(updated),
      meta: {
        warnings,
        activeSalaryRecordCount,
      },
    };
  }

  async findRankSteps(
    rankGroup: RankGroup,
    query?: { active?: string },
  ): Promise<Record<string, unknown>[]> {
    const where: Prisma.CivilServantRankStepWhereInput = { rankGroup };
    if (query?.active === 'true') {
      where.isActive = true;
    } else if (query?.active === 'false') {
      where.isActive = false;
    }

    const steps = await this.prisma.civilServantRankStep.findMany({
      where,
      orderBy: [{ level: 'asc' }],
    });

    return steps.map((step) => this.normalizeRankStep(step));
  }

  async findRankStepsByRankId(
    rankId: string,
    query?: { active?: string },
  ): Promise<Record<string, unknown>[]> {
    const rank = await this.ensureRankExists(rankId);
    return this.findRankSteps(rank.rankGroup, query);
  }

  async createRankStep(
    rankGroup: RankGroup,
    dto: CreateRankStepDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ): Promise<DataMeta<Record<string, unknown>>> {
    const created = await this.prisma.civilServantRankStep.create({
      data: {
        rankGroup,
        level: dto.level,
        coefficient: dto.coefficient,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'SALARY',
      created.id,
      'CREATE',
      this.withAuditMeta(
        {
          rankGroup: created.rankGroup,
          level: created.level,
          coefficient: this.toNumber(created.coefficient),
          isActive: created.isActive,
        },
        requestPath,
      ),
      context ?? undefined,
    );

    return { data: this.normalizeRankStep(created), meta: {} };
  }

  async updateRankStep(
    id: string,
    dto: UpdateRankStepDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ): Promise<DataMeta<Record<string, unknown>>> {
    const existing = await this.prisma.civilServantRankStep.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Bac luong khong ton tai.');
    }

    const updated = await this.prisma.civilServantRankStep.update({
      where: { id },
      data: {
        level: dto.level,
        coefficient: dto.coefficient,
        isActive: dto.isActive,
      },
    });

    const activeSalaryRecordCount =
      dto.isActive === false && existing.isActive
        ? await this.prisma.salaryRecord.count({
            where: {
              rankStepId: id,
              effectiveTo: null,
            },
          })
        : 0;

    const warnings =
      activeSalaryRecordCount > 0
        ? [
            `Co ${activeSalaryRecordCount} ho so luong dang hieu luc dang tham chieu bac nay.`,
            'Bac da vo hieu hoa se bi chan cho quyet dinh moi, nhung lich su cu van duoc giu.',
          ]
        : [];

    await this.auditService.record(
      this.toAuditActor(actor),
      'SALARY',
      updated.id,
      'UPDATE',
      this.withAuditMeta(
        {
          before: this.normalizeRankStep(existing),
          after: this.normalizeRankStep(updated),
          warnings,
        },
        requestPath,
      ),
      context ?? undefined,
    );

    return {
      data: this.normalizeRankStep(updated),
      meta: {
        warnings,
        activeSalaryRecordCount,
      },
    };
  }

  // -- Salary Records --------------------------------------------------------

  async findAllRecords(employeeId: string, user: CurrentUserPayload) {
    const employee = await this.getEmployeeScopeInfo(employeeId);
    await this.assertCanReadEmployee(employee, user);

    const records = await this.prisma.salaryRecord.findMany({
      where: { employeeId },
      include: {
        civilServantRank: {
          select: {
            id: true,
            code: true,
            name: true,
            rankGroup: true,
            isActive: true,
            category: true,
          },
        },
        rankStep: {
          select: {
            id: true,
            level: true,
            coefficient: true,
            isActive: true,
          },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return records.map((record) => this.normalizeSalaryRecord(record));
  }

  async createRecord(
    employeeId: string,
    dto: CreateSalaryRecordDto,
    actor: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    await this.getEmployeeScopeInfo(employeeId);
    this.assertCanWriteEmployee(actor);

    const rank = await this.prisma.civilServantRank.findUnique({
      where: { id: dto.civilServantRankId },
    });
    if (!rank) {
      throw new NotFoundException('Ngach/chuc danh khong ton tai.');
    }
    if (!rank.isActive) {
      throw new BadRequestException(
        'Ngach/chuc danh da het hieu luc, khong the tao quyet dinh moi.',
      );
    }

    const rankStep = await this.prisma.civilServantRankStep.findUnique({
      where: {
        rankGroup_level: {
          rankGroup: rank.rankGroup,
          level: dto.salaryLevel,
        },
      },
    });
    if (!rankStep) {
      throw new NotFoundException(
        'Khong tim thay bac luong tuong ung voi ngach da chon.',
      );
    }
    if (!rankStep.isActive) {
      throw new BadRequestException(
        'Bac luong da het hieu luc, khong the tao quyet dinh moi.',
      );
    }

    const cycleMonths = RAISE_CYCLE_MONTHS[rank.rankGroup] ?? 36;
    const currentLevelDate = new Date(dto.currentLevelDate);
    const expectedRaiseDate = new Date(currentLevelDate);
    expectedRaiseDate.setMonth(expectedRaiseDate.getMonth() + cycleMonths);
    const effectiveFrom = new Date(dto.effectiveFrom);
    const decisionNo = dto.decisionNo?.trim() || null;

    const duplicateEffectiveFrom = await this.prisma.salaryRecord.findFirst({
      where: {
        employeeId,
        effectiveFrom,
      },
      select: { id: true },
    });
    if (duplicateEffectiveFrom) {
      throw new ConflictException(
        'Da ton tai quyet dinh luong cho ngay hieu luc nay.',
      );
    }

    if (decisionNo) {
      const duplicateDecisionNo = await this.prisma.salaryRecord.findFirst({
        where: {
          employeeId,
          decisionNo,
        },
        select: { id: true },
      });
      if (duplicateDecisionNo) {
        throw new ConflictException(
          'So quyet dinh luong da ton tai cho nhan su nay.',
        );
      }
    }

    let result:
      | Prisma.SalaryRecordGetPayload<{
          include: {
            civilServantRank: {
              select: {
                id: true;
                code: true;
                name: true;
                rankGroup: true;
                isActive: true;
                category: true;
              };
            };
            rankStep: {
              select: {
                id: true;
                level: true;
                coefficient: true;
                isActive: true;
              };
            };
          };
        }>
      | undefined;

    try {
      result = await this.prisma.$transaction(async (tx) => {
        const previousRecord = await tx.salaryRecord.findFirst({
          where: { employeeId, effectiveTo: null },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (previousRecord) {
          const closingDate = new Date(effectiveFrom);
          closingDate.setDate(closingDate.getDate() - 1);
          await tx.salaryRecord.update({
            where: { id: previousRecord.id },
            data: { effectiveTo: closingDate },
          });
        }

        return tx.salaryRecord.create({
          data: {
            employeeId,
            civilServantRankId: dto.civilServantRankId,
            rankStepId: rankStep.id,
            decisionNo,
            salaryLevel: dto.salaryLevel,
            coefficient: rankStep.coefficient,
            currentLevelDate,
            expectedRaiseDate,
            effectiveFrom,
            effectiveTo: null,
            percentEnjoy: dto.percentEnjoy ?? 100,
            seniorityAllowance: dto.seniorityAllowance ?? null,
            positionAllowance: dto.positionAllowance ?? null,
            concurrentAllowance: dto.concurrentAllowance ?? null,
            otherAllowance: dto.otherAllowance ?? null,
          },
          include: {
            civilServantRank: {
              select: {
                id: true,
                code: true,
                name: true,
                rankGroup: true,
                isActive: true,
                category: true,
              },
            },
            rankStep: {
              select: {
                id: true,
                level: true,
                coefficient: true,
                isActive: true,
              },
            },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Du lieu quyet dinh luong bi trung. Vui long kiem tra ngay hieu luc va so quyet dinh.',
          );
        }
      }
      throw error;
    }

    if (!result) {
      throw new BadRequestException('Khong the tao quyet dinh luong.');
    }

    await this.auditService.record(
      this.toAuditActor(actor),
      'SALARY',
      result.id,
      'CREATE',
      this.withAuditMeta(
        {
          employeeId,
          rankCode: rank.code,
          salaryLevel: dto.salaryLevel,
          coefficient: this.toNumber(rankStep.coefficient),
          expectedRaiseDate: expectedRaiseDate.toISOString(),
          decisionNo: dto.decisionNo ?? null,
        },
        requestPath,
      ),
      context ?? undefined,
    );

    return this.normalizeSalaryRecord(result);
  }

  // -- Scope & Permission Helpers -------------------------------------------

  private async getEmployeeScopeInfo(
    employeeId: string,
  ): Promise<EmployeeScopeInfo> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, unitId: true },
    });
    if (!employee) {
      throw new NotFoundException('Nhan vien khong ton tai.');
    }
    return employee;
  }

  private async assertCanReadEmployee(
    employee: EmployeeScopeInfo,
    user: CurrentUserPayload,
  ) {
    const perms = user.permissions ?? [];

    if (perms.includes(PERMISSIONS.SALARY_READ)) {
      return;
    }

    if (perms.includes(PERMISSIONS.SALARY_READ_OWN)) {
      const userEmployee = await this.prisma.employee.findFirst({
        where: { user: { id: user.userId } },
        select: { id: true },
      });
      if (userEmployee && userEmployee.id === employee.id) {
        return;
      }
    }

    throw new ForbiddenException(
      'Ban khong co quyen xem thong tin luong cua nhan vien nay.',
    );
  }

  private assertCanWriteEmployee(user: CurrentUserPayload) {
    const perms = user.permissions ?? [];
    if (!perms.includes(PERMISSIONS.SALARY_WRITE)) {
      throw new ForbiddenException('Ban khong co quyen chinh sua luong.');
    }
  }

  private async ensureRankExists(rankId: string) {
    const rank = await this.prisma.civilServantRank.findUnique({
      where: { id: rankId },
      select: { id: true, rankGroup: true },
    });
    if (!rank) {
      throw new NotFoundException('Ngach/chuc danh khong ton tai.');
    }
    return rank;
  }

  private validateSectorGroup(value: string): SectorGroup {
    const normalized = normalizeSectorGroup(value);
    if (!isValidSectorGroup(normalized)) {
      throw new BadRequestException(
        `sectorGroup "${value}" khong hop le. Gia tri hop le: ${VALID_SECTOR_GROUPS.join(', ')}`,
      );
    }
    return normalized;
  }

  // -- Serialization Helpers -------------------------------------------------

  private normalizeRank(
    rank: Prisma.CivilServantRankGetPayload<Record<string, never>>,
  ): Record<string, unknown> {
    return {
      ...rank,
      minCoefficient: this.toNullableNumber(rank.minCoefficient),
      maxCoefficient: this.toNullableNumber(rank.maxCoefficient),
    };
  }

  private normalizeRankStep(
    step: Prisma.CivilServantRankStepGetPayload<Record<string, never>>,
  ): Record<string, unknown> {
    return {
      ...step,
      coefficient: this.toNumber(step.coefficient),
    };
  }

  private normalizeSalaryRecord(
    record: Prisma.SalaryRecordGetPayload<{
      include: {
        civilServantRank: {
          select: {
            id: true;
            code: true;
            name: true;
            rankGroup: true;
            isActive: true;
            category: true;
          };
        };
        rankStep: {
          select: {
            id: true;
            level: true;
            coefficient: true;
            isActive: true;
          };
        };
      };
    }>,
  ): Record<string, unknown> {
    return {
      ...record,
      coefficient: this.toNumber(record.coefficient),
      rankStep: record.rankStep
        ? {
            ...record.rankStep,
            coefficient: this.toNumber(record.rankStep.coefficient),
          }
        : null,
    };
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
    return {
      ...changes,
      ...(requestPath ? { _requestPath: requestPath } : {}),
      _timestamp: new Date().toISOString(),
    } as Prisma.InputJsonValue;
  }

  private toNumber(value: Prisma.Decimal): number {
    return Number(value.toString());
  }

  private toNullableNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : this.toNumber(value);
  }
}
