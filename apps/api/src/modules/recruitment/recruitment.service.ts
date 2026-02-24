import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CandidateStatus,
  Gender,
  Prisma,
  RecruitmentCampaignStatus,
} from '@prisma/client';
import type { CurrentUserPayload } from '../../auth/interfaces';
import { EmployeesService } from '../../employees/employees.service';
import type { CreateEmployeeDto } from '../../employees/dto/create-employee.dto';
import { PrismaService } from '../../prisma';
import {
  AuditService,
  type AuditActor,
  type AuditContext,
} from '../audit/audit.service';
import type {
  ConvertCandidateDto,
  CreateCampaignDto,
  CreateCandidateDto,
  ListCampaignsQueryDto,
  ListCandidatesQueryDto,
  UpdateCampaignDto,
  UpdateCandidateStatusDto,
} from './dto';

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
    private readonly auditService: AuditService,
  ) {}

  async listCampaigns(query: ListCampaignsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.RecruitmentCampaignWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.unitId) {
      where.unitId = query.unitId;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.recruitmentCampaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          unit: {
            select: { id: true, code: true, name: true },
          },
          position: {
            select: { id: true, code: true, name: true },
          },
          _count: {
            select: { candidates: true },
          },
        },
      }),
      this.prisma.recruitmentCampaign.count({ where }),
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

  async createCampaign(
    dto: CreateCampaignDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
  ) {
    await this.ensureUnitExists(dto.unitId);
    if (dto.positionId) {
      await this.ensurePositionExists(dto.positionId);
    }

    const campaign = await this.prisma.recruitmentCampaign.create({
      data: {
        title: dto.title,
        description: dto.description,
        unitId: dto.unitId,
        positionId: dto.positionId,
        quantity: dto.quantity ?? 1,
        deadline: new Date(dto.deadline),
        status: dto.status ?? RecruitmentCampaignStatus.DRAFT,
        createdById: actor?.userId,
        updatedById: actor?.userId,
      },
      include: {
        unit: {
          select: { id: true, code: true, name: true },
        },
        position: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'RECRUITMENT',
      campaign.id,
      'CREATE',
      {
        after: {
          title: campaign.title,
          unitId: campaign.unitId,
          positionId: campaign.positionId,
          quantity: campaign.quantity,
          deadline: campaign.deadline,
          status: campaign.status,
        },
      },
      context,
    );

    return campaign;
  }

  async updateCampaign(
    id: string,
    dto: UpdateCampaignDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
  ) {
    const existing = await this.prisma.recruitmentCampaign.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Campaign #${id} not found`);
    }

    if (dto.unitId) {
      await this.ensureUnitExists(dto.unitId);
    }
    if (dto.positionId) {
      await this.ensurePositionExists(dto.positionId);
    }

    const updated = await this.prisma.recruitmentCampaign.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        unitId: dto.unitId,
        positionId: dto.positionId,
        quantity: dto.quantity,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        status: dto.status,
        updatedById: actor?.userId,
      },
      include: {
        unit: {
          select: { id: true, code: true, name: true },
        },
        position: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'RECRUITMENT',
      updated.id,
      'UPDATE',
      {
        before: {
          title: existing.title,
          unitId: existing.unitId,
          positionId: existing.positionId,
          quantity: existing.quantity,
          deadline: existing.deadline,
          status: existing.status,
        },
        after: {
          title: updated.title,
          unitId: updated.unitId,
          positionId: updated.positionId,
          quantity: updated.quantity,
          deadline: updated.deadline,
          status: updated.status,
        },
      },
      context,
    );

    return updated;
  }

  async listCandidates(campaignId: string, query: ListCandidatesQueryDto) {
    await this.ensureCampaignExists(campaignId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CandidateWhereInput = { campaignId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ appliedAt: 'desc' }],
        include: {
          employee: {
            select: { id: true, employeeCode: true, fullName: true },
          },
        },
      }),
      this.prisma.candidate.count({ where }),
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

  async createCandidate(campaignId: string, dto: CreateCandidateDto) {
    const campaign = await this.ensureCampaignExists(campaignId);
    if (
      campaign.status === RecruitmentCampaignStatus.CLOSED ||
      campaign.status === RecruitmentCampaignStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot add candidate to a closed or cancelled campaign',
      );
    }

    await this.ensureCandidateUniqueness(campaignId, dto.email, dto.citizenId);

    return this.prisma.candidate.create({
      data: {
        campaignId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        dob: dto.dob ? new Date(dto.dob) : null,
        gender: dto.gender,
        citizenId: dto.citizenId,
        currentAddress: dto.currentAddress,
        cvFileUrl: dto.cvFileUrl,
        source: dto.source ?? 'HR_INTERNAL',
        notes: dto.notes,
        status: dto.status ?? CandidateStatus.APPLIED,
      },
    });
  }

  async updateCandidateStatus(
    id: string,
    dto: UpdateCandidateStatusDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
  ) {
    const existing = await this.prisma.candidate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Candidate #${id} not found`);
    }

    if (
      existing.status === CandidateStatus.CONVERTED &&
      dto.status !== CandidateStatus.CONVERTED
    ) {
      throw new BadRequestException(
        'Converted candidate status cannot be changed',
      );
    }

    const updated = await this.prisma.candidate.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'CANDIDATE',
      updated.id,
      'UPDATE',
      {
        before: { status: existing.status },
        after: { status: updated.status },
      },
      context,
    );

    return updated;
  }

  async convertCandidate(
    id: string,
    dto: ConvertCandidateDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
  ) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: { campaign: true },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate #${id} not found`);
    }
    if (
      candidate.status === CandidateStatus.CONVERTED ||
      candidate.employeeId
    ) {
      throw new BadRequestException('Candidate is already converted');
    }
    if (candidate.status === CandidateStatus.REJECTED) {
      throw new BadRequestException('Rejected candidate cannot be converted');
    }

    const citizenId = dto.citizenId ?? candidate.citizenId;
    if (!citizenId) {
      throw new BadRequestException(
        'Missing citizen ID. Provide citizenId in convert request.',
      );
    }

    const dobAsIso = dto.dob ?? candidate.dob?.toISOString();
    if (!dobAsIso) {
      throw new BadRequestException(
        'Missing date of birth. Provide dob in convert request.',
      );
    }

    const gender = dto.gender ?? candidate.gender;
    if (!gender || !Object.values(Gender).includes(gender)) {
      throw new BadRequestException(
        'Missing gender. Provide gender in convert request.',
      );
    }

    const email = dto.email ?? candidate.email;
    if (!email) {
      throw new BadRequestException(
        'Missing email. Provide email in convert request.',
      );
    }

    const createEmployeePayload: CreateEmployeeDto = {
      employeeCode: dto.employeeCode,
      fullName: dto.fullName ?? candidate.fullName,
      citizenId,
      dob: dobAsIso,
      gender,
      email,
      phone: dto.phone ?? candidate.phone ?? undefined,
      unitId: dto.unitId ?? candidate.campaign.unitId,
      initialRecruitmentDate: dto.initialRecruitmentDate,
      currentOrgJoinDate: dto.currentOrgJoinDate,
      officialDate: dto.officialDate,
      status: dto.employeeStatus,
    };

    const employee = await this.employeesService.create(createEmployeePayload);

    const convertedCandidate = await this.prisma.candidate.update({
      where: { id },
      data: {
        status: CandidateStatus.CONVERTED,
        employeeId: employee.id,
        convertedAt: new Date(),
        convertedById: actor?.userId,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'CANDIDATE',
      convertedCandidate.id,
      'CONVERT',
      {
        candidateId: convertedCandidate.id,
        campaignId: convertedCandidate.campaignId,
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
      },
      context,
    );

    return {
      candidate: convertedCandidate,
      employee,
      message: 'Candidate converted to employee successfully',
    };
  }

  async listPublicCampaigns() {
    return this.prisma.recruitmentCampaign.findMany({
      where: {
        status: RecruitmentCampaignStatus.ACTIVE,
        deadline: { gte: new Date() },
      },
      orderBy: [{ deadline: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        quantity: true,
        deadline: true,
        createdAt: true,
        unit: {
          select: { id: true, name: true, code: true },
        },
        position: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async applyPublic(campaignId: string, dto: CreateCandidateDto) {
    const campaign = await this.ensureCampaignExists(campaignId);
    if (campaign.status !== RecruitmentCampaignStatus.ACTIVE) {
      throw new BadRequestException('Campaign is not accepting applications');
    }
    if (campaign.deadline < new Date()) {
      throw new BadRequestException('Application deadline has passed');
    }

    await this.ensureCandidateUniqueness(campaignId, dto.email, dto.citizenId);

    return this.prisma.candidate.create({
      data: {
        campaignId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        dob: dto.dob ? new Date(dto.dob) : null,
        gender: dto.gender,
        citizenId: dto.citizenId,
        currentAddress: dto.currentAddress,
        cvFileUrl: dto.cvFileUrl,
        source: dto.source ?? 'PUBLIC_PORTAL',
        notes: dto.notes,
        status: CandidateStatus.APPLIED,
      },
      select: {
        id: true,
        campaignId: true,
        fullName: true,
        email: true,
        status: true,
        appliedAt: true,
      },
    });
  }

  private async ensureCampaignExists(id: string) {
    const campaign = await this.prisma.recruitmentCampaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign #${id} not found`);
    }
    return campaign;
  }

  private async ensureUnitExists(unitId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException(`Unit #${unitId} not found`);
    }
    if (unit.isDeleted) {
      throw new BadRequestException(
        'Cannot bind campaign to a soft-deleted unit',
      );
    }
  }

  private async ensurePositionExists(positionId: string): Promise<void> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });
    if (!position) {
      throw new NotFoundException(`Position #${positionId} not found`);
    }
  }

  private async ensureCandidateUniqueness(
    campaignId: string,
    email: string,
    citizenId?: string,
  ): Promise<void> {
    const where: Prisma.CandidateWhereInput = citizenId
      ? {
          campaignId,
          OR: [{ email }, { citizenId }],
        }
      : {
          campaignId,
          email,
        };

    const existing = await this.prisma.candidate.findFirst({ where });
    if (existing) {
      throw new ConflictException(
        'Candidate with this email/citizenId already exists in this campaign',
      );
    }
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
}
