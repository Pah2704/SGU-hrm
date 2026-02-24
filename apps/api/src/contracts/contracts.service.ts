import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/interfaces';
import {
  AuditService,
  type AuditActor,
  type AuditContext,
} from '../modules/audit/audit.service';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    createContractDto: CreateContractDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const { employeeId, ...rest } = createContractDto;

    // Verify employee exists? Prisma foreign key constraint handles this,
    // but explicit check gives better error. For now, rely on Prisma.

    const created = await this.prisma.contract.create({
      data: {
        ...rest,
        startDate: new Date(rest.startDate),
        endDate: rest.endDate ? new Date(rest.endDate) : null,
        signedDate: rest.signedDate ? new Date(rest.signedDate) : null,
        employee: { connect: { id: employeeId } },
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'CONTRACT',
      created.id,
      'CREATE',
      this.withAuditMeta(
        {
          after: {
            employeeId: created.employeeId,
            contractNumber: created.contractNumber,
            contractType: created.contractType,
            status: created.status,
            startDate: this.toIsoOrNull(created.startDate),
            endDate: this.toIsoOrNull(created.endDate),
          },
        },
        requestPath,
      ),
      context,
    );

    return created;
  }

  async findAll(employeeId?: string) {
    const where: Prisma.ContractWhereInput = {};
    if (employeeId) {
      where.employeeId = employeeId;
    }

    return this.prisma.contract.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        appendices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract #${id} not found`);
    }
    return contract;
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    await this.findOne(id); // Ensure exists
    const before = await this.prisma.contract.findUnique({
      where: { id },
      select: {
        employeeId: true,
        contractNumber: true,
        contractType: true,
        status: true,
        startDate: true,
        endDate: true,
        signedDate: true,
      },
    });

    const { employeeId, startDate, endDate, signedDate, ...rest } =
      updateContractDto;
    const data: Prisma.ContractUpdateInput = {
      ...rest,
    };

    if (startDate) {
      data.startDate = new Date(startDate);
    }
    if (endDate) {
      data.endDate = new Date(endDate);
    }
    if (signedDate) {
      data.signedDate = new Date(signedDate);
    }

    // If employeeId is allow to be changed (rare)
    if (employeeId) {
      data.employee = { connect: { id: employeeId } };
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data,
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'CONTRACT',
      id,
      'UPDATE',
      this.withAuditMeta(
        {
          before: before
            ? {
                employeeId: before.employeeId,
                contractNumber: before.contractNumber,
                contractType: before.contractType,
                status: before.status,
                startDate: this.toIsoOrNull(before.startDate),
                endDate: this.toIsoOrNull(before.endDate),
                signedDate: this.toIsoOrNull(before.signedDate),
              }
            : null,
          after: {
            employeeId: updated.employeeId,
            contractNumber: updated.contractNumber,
            contractType: updated.contractType,
            status: updated.status,
            startDate: this.toIsoOrNull(updated.startDate),
            endDate: this.toIsoOrNull(updated.endDate),
            signedDate: this.toIsoOrNull(updated.signedDate),
          },
        },
        requestPath,
      ),
      context,
    );

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contract.delete({ where: { id } });
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
