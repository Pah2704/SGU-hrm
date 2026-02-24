import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma';
import { CreateUserDto, UpdateUserDto } from './dto';
import type { CurrentUserPayload } from '../auth/interfaces';
import { Prisma } from '@prisma/client';
import {
  AuditService,
  type AuditActor,
  type AuditContext,
} from '../modules/audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Get all users (admin only)
   */
  async findAll(params: { skip?: number; take?: number } = {}) {
    const { skip = 0, take = 50 } = params;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        select: {
          id: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          roles: {
            select: {
              role: {
                select: { name: true, displayName: true },
              },
            },
          },
          employee: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users.map((u) => ({
        ...u,
        roles: u.roles.map((r) => r.role),
      })),
      meta: { total, skip, take },
    };
  }

  /**
   * Get user by ID
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
            unit: {
              select: { id: true, name: true },
            },
          },
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            unit: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      roles: user.roles.map((r) => ({ ...r.role, unit: r.unit })),
    };
  }

  /**
   * Create new user (admin only)
   */
  async create(
    dto: CreateUserDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    // Check email uniqueness
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        isActive: dto.isActive ?? true,
        roles: dto.roleIds?.length
          ? {
              create: dto.roleIds.map((roleId) => ({
                roleId,
                unitId: dto.unitId,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (dto.roleIds?.length) {
      await this.auditService.record(
        this.toAuditActor(actor),
        'USER',
        user.id,
        'ASSIGN_ROLE',
        this.withAuditMeta(
          {
            userId: user.id,
            addedRoleIds: dto.roleIds,
            unitId: dto.unitId ?? null,
          },
          requestPath,
        ),
        context,
      );
    }

    return user;
  }

  /**
   * Update user
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
    requestPath?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changing
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('Email already exists');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.email) updateData.email = dto.email;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const existingRoles = dto.roleIds
      ? await this.prisma.userRole.findMany({
          where: { userId: id },
          select: { roleId: true },
        })
      : [];

    // Update roles if provided
    if (dto.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({
          userId: id,
          roleId,
          unitId: dto.unitId,
        })),
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (dto.roleIds) {
      const previousRoleIds = Array.from(
        new Set(existingRoles.map((item) => item.roleId)),
      );
      const newRoleIds = Array.from(new Set(dto.roleIds));
      const previousRoleIdSet = new Set(previousRoleIds);
      const newRoleIdSet = new Set(newRoleIds);

      const addedRoleIds = newRoleIds.filter(
        (roleId) => !previousRoleIdSet.has(roleId),
      );
      const removedRoleIds = previousRoleIds.filter(
        (roleId) => !newRoleIdSet.has(roleId),
      );

      if (addedRoleIds.length > 0) {
        await this.auditService.record(
          this.toAuditActor(actor),
          'USER',
          id,
          'ASSIGN_ROLE',
          this.withAuditMeta(
            {
              userId: id,
              addedRoleIds,
              unitId: dto.unitId ?? null,
            },
            requestPath,
          ),
          context,
        );
      }

      if (removedRoleIds.length > 0) {
        await this.auditService.record(
          this.toAuditActor(actor),
          'USER',
          id,
          'REVOKE_ROLE',
          this.withAuditMeta(
            {
              userId: id,
              removedRoleIds,
            },
            requestPath,
          ),
          context,
        );
      }
    }

    return updatedUser;
  }

  /**
   * Soft delete user (deactivate)
   */
  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'User deactivated successfully' };
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
