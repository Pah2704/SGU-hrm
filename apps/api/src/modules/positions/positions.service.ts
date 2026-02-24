import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../../auth/interfaces';
import {
  AuditService,
  type AuditActor,
  type AuditContext,
} from '../audit/audit.service';

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    createPositionDto: CreatePositionDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const created = await this.prisma.position.create({
      data: createPositionDto,
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'POSITION',
      created.id,
      'CREATE',
      this.withAuditMeta(
        {
          after: {
            code: created.code,
            name: created.name,
            positionType: created.positionType,
            level: created.level,
          },
        },
        requestPath,
      ),
      context,
    );

    return created;
  }

  async findAll() {
    return this.prisma.position.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.position.findUnique({
      where: { id },
    });
  }

  async update(
    id: string,
    updatePositionDto: UpdatePositionDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const before = await this.prisma.position.findUnique({
      where: { id },
      select: {
        code: true,
        name: true,
        positionType: true,
        level: true,
      },
    });

    const updated = await this.prisma.position.update({
      where: { id },
      data: updatePositionDto,
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'POSITION',
      id,
      'UPDATE',
      this.withAuditMeta(
        {
          before,
          after: {
            code: updated.code,
            name: updated.name,
            positionType: updated.positionType,
            level: updated.level,
          },
        },
        requestPath,
      ),
      context,
    );

    return updated;
  }

  async remove(id: string) {
    // Soft delete logic or check if used before delete
    // For now, strict delete
    return this.prisma.position.delete({
      where: { id },
    });
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
}
