import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type AuditEntityType =
  | 'AUTH'
  | 'USER'
  | 'ROLE'
  | 'PERMISSION'
  | 'UNIT'
  | 'EMPLOYEE'
  | 'CONTRACT'
  | 'POSITION'
  | 'DECISION'
  | 'SALARY'
  | 'LEAVE'
  | 'DEGREE'
  | 'CERTIFICATE'
  | 'RECRUITMENT'
  | 'CANDIDATE';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'SOFT_DELETE'
  | 'HARD_DELETE'
  | 'STATUS_CHANGE'
  | 'CLOSE_TERM'
  | 'ASSIGN_ROLE'
  | 'REVOKE_ROLE'
  | 'ATTACH_PERMISSION'
  | 'DETACH_PERMISSION'
  | 'LOGIN'
  | 'REFRESH'
  | 'LOGOUT'
  | 'APPROVE'
  | 'REJECT'
  | 'CONVERT';

export interface AuditActor {
  userId?: string;
  role?: string | null;
  roles?: string[];
}

export interface AuditContext {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async record(
    actor: AuditActor | null | undefined,
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction,
    changes?: Prisma.InputJsonValue,
    context?: AuditContext,
  ): Promise<void> {
    const actorRole = actor?.role ?? actor?.roles?.[0] ?? null;

    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          actorUserId: actor?.userId ?? null,
          actorRole,
          changes: changes ?? Prisma.JsonNull,
          ip: context?.ip ?? null,
          userAgent: context?.userAgent ?? null,
          requestId: context?.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${entityType}:${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
      // Never break business flow on audit failure.
    }
  }
}
