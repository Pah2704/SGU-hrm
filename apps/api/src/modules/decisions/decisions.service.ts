import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../../auth/interfaces';
import {
  AuditService,
  type AuditActor,
  type AuditContext,
} from '../audit/audit.service';

@Injectable()
export class DecisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    createDecisionDto: CreateDecisionDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const { createdDecision, closedPrimaryBefore, closedPrimaryAfter } =
      await this.prisma.$transaction(async (tx) => {
        let previousPrimaryBefore: { id: string; endDate: Date | null } | null =
          null;
        let previousPrimaryAfter: { id: string; endDate: Date | null } | null =
          null;

        // 1. If new position is primary, close the current primary position
        if (createDecisionDto.isPrimary) {
          const currentPrimary = await tx.employeePosition.findFirst({
            where: {
              employeeId: createDecisionDto.employeeId,
              isPrimary: true,
              endDate: null,
            },
          });

          if (currentPrimary) {
            previousPrimaryBefore = {
              id: currentPrimary.id,
              endDate: currentPrimary.endDate,
            };
            // Close it effective yesterday or same day?
            // Using appointDate of new position as endDate of old one implies seamless transition
            const closedPrimary = await tx.employeePosition.update({
              where: { id: currentPrimary.id },
              data: { endDate: createDecisionDto.appointDate },
            });
            previousPrimaryAfter = {
              id: closedPrimary.id,
              endDate: closedPrimary.endDate,
            };
          }

          // Update Employee's currentPosition string for quick access/display
          const pos = await tx.position.findUnique({
            where: { id: createDecisionDto.positionId },
          });
          if (pos) {
            await tx.employee.update({
              where: { id: createDecisionDto.employeeId },
              data: {
                currentPosition: pos.name,
                appointDate: new Date(createDecisionDto.appointDate),
              },
            });
          }
        }

        // 2. Create the new record
        const created = await tx.employeePosition.create({
          data: {
            employeeId: createDecisionDto.employeeId,
            positionId: createDecisionDto.positionId,
            isPrimary: createDecisionDto.isPrimary,
            appointDate: createDecisionDto.appointDate,
            decisionNo: createDecisionDto.decisionNo,
            decisionDate: createDecisionDto.decisionDate,
            documentUrl: createDecisionDto.documentUrl,
          },
          include: { position: true },
        });

        return {
          createdDecision: created,
          closedPrimaryBefore: previousPrimaryBefore,
          closedPrimaryAfter: previousPrimaryAfter,
        };
      });

    if (closedPrimaryBefore && closedPrimaryAfter) {
      await this.auditService.record(
        this.toAuditActor(actor),
        'DECISION',
        closedPrimaryAfter.id,
        'CLOSE_TERM',
        this.withAuditMeta(
          {
            before: {
              id: closedPrimaryBefore.id,
              endDate: this.toIsoOrNull(closedPrimaryBefore.endDate),
            },
            after: {
              id: closedPrimaryAfter.id,
              endDate: this.toIsoOrNull(closedPrimaryAfter.endDate),
            },
          },
          requestPath,
        ),
        context,
      );
    }

    await this.auditService.record(
      this.toAuditActor(actor),
      'DECISION',
      createdDecision.id,
      'CREATE',
      this.withAuditMeta(
        {
          after: {
            employeeId: createdDecision.employeeId,
            positionId: createdDecision.positionId,
            isPrimary: createdDecision.isPrimary,
            appointDate: this.toIsoOrNull(createdDecision.appointDate),
            decisionNo: createdDecision.decisionNo,
            decisionDate: this.toIsoOrNull(createdDecision.decisionDate),
            endDate: this.toIsoOrNull(createdDecision.endDate),
          },
        },
        requestPath,
      ),
      context,
    );

    return createdDecision;
  }

  async findAllByEmployee(employeeId: string) {
    return this.prisma.employeePosition.findMany({
      where: { employeeId },
      include: { position: true },
      orderBy: { appointDate: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.employeePosition.findUnique({
      where: { id },
      include: { position: true },
    });
  }

  async update(
    id: string,
    updateDecisionDto: UpdateDecisionDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const before = await this.prisma.employeePosition.findUnique({
      where: { id },
      select: {
        employeeId: true,
        positionId: true,
        isPrimary: true,
        appointDate: true,
        decisionNo: true,
        decisionDate: true,
        endDate: true,
      },
    });

    const updated = await this.prisma.employeePosition.update({
      where: { id },
      data: updateDecisionDto,
    });

    const action =
      !before?.endDate && Boolean(updateDecisionDto.endDate)
        ? 'CLOSE_TERM'
        : 'UPDATE';

    await this.auditService.record(
      this.toAuditActor(actor),
      'DECISION',
      id,
      action,
      this.withAuditMeta(
        {
          before: before
            ? {
                employeeId: before.employeeId,
                positionId: before.positionId,
                isPrimary: before.isPrimary,
                appointDate: this.toIsoOrNull(before.appointDate),
                decisionNo: before.decisionNo,
                decisionDate: this.toIsoOrNull(before.decisionDate),
                endDate: this.toIsoOrNull(before.endDate),
              }
            : null,
          after: {
            employeeId: updated.employeeId,
            positionId: updated.positionId,
            isPrimary: updated.isPrimary,
            appointDate: this.toIsoOrNull(updated.appointDate),
            decisionNo: updated.decisionNo,
            decisionDate: this.toIsoOrNull(updated.decisionDate),
            endDate: this.toIsoOrNull(updated.endDate),
          },
        },
        requestPath,
      ),
      context,
    );

    return updated;
  }

  remove(id: string) {
    void id;
    // START_TODO: Enforce "history records are never hard-deleted"
    // Instead of delete, we might just throw error or set status to INACTIVE/CANCELLED if schema supported it.
    // For now, allow DELETE only if it was created by mistake?
    // Or strictly forbid:
    throw new BadRequestException(
      'History records cannot be deleted. Please set endDate to close the position.',
    );
    // END_TODO
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
