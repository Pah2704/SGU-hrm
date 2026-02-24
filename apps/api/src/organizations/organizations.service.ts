import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto, UpdateUnitDto } from './dto';
import type { CurrentUserPayload } from '../auth/interfaces';
import {
  AuditService,
  AuditActor,
  AuditContext,
} from '../modules/audit/audit.service';

// Tree node shape for API response
export interface TreeUnitDto {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  unitType: string;
  status: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  level: number;
  sortOrder: number;
  parentId: string | null;
  children: TreeUnitDto[];
}

@Injectable()
export class OrganizationsService {
  private static readonly SORT_ORDER_STEP = 10;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private static readonly ROOT_UNIT_CODE = 'SGU';
  private static readonly ROOT_PATH_PREFIX = 'sgu';

  /**
   * GET /units â€” return nested tree of all units
   */
  async getTree(options?: {
    includeSoftDeleted?: boolean;
  }): Promise<TreeUnitDto[]> {
    const units = await this.prisma.unit.findMany({
      where: options?.includeSoftDeleted ? undefined : { isDeleted: false },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    return this.buildTree(units);
  }

  /**
   * GET /units/:id â€” single unit detail
   */
  async findOne(id: string): Promise<Unit> {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        _count: { select: { employees: true } },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with id "${id}" not found`);
    }

    return unit;
  }

  /**
   * POST /units â€” create a new unit, compute path and level from parent
   */
  async create(
    dto: CreateUnitDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
  ): Promise<Unit> {
    // Check code uniqueness
    const existing = await this.prisma.unit.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Unit code "${dto.code}" already exists`);
    }

    if (!dto.parentId) {
      throw new BadRequestException(
        'Cannot create root-level unit. SGU is the only top-level unit.',
      );
    }

    let path = dto.code.toLowerCase();
    let level = 0;

    // If parent specified, compute path and level
    if (dto.parentId) {
      const parent = await this.prisma.unit.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent unit with id "${dto.parentId}" not found`,
        );
      }
      if (!this.isInSguHierarchy(parent.path)) {
        throw new BadRequestException(
          'Parent unit must belong to SGU hierarchy.',
        );
      }
      path = `${parent.path}.${dto.code.toLowerCase()}`;
      level = parent.level + 1;
    }

    const resolvedSortOrder = await this.resolveSortOrder(
      dto.parentId || null,
      dto.sortOrder,
    );

    const createdUnit = await this.prisma.unit.create({
      data: {
        code: dto.code,
        name: dto.name,
        shortName: dto.shortName,
        parentId: dto.parentId || null,
        unitType: dto.unitType,
        path,
        level,
        sortOrder: resolvedSortOrder,
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'UNIT',
      createdUnit.id,
      'CREATE',
      {
        after: {
          code: createdUnit.code,
          name: createdUnit.name,
          parentId: createdUnit.parentId,
          unitType: createdUnit.unitType,
          status: createdUnit.status,
          sortOrder: createdUnit.sortOrder,
        },
      },
      context,
    );

    return createdUnit;
  }

  /**
   * PATCH /units/:id â€” update unit, recalculate path if parent changed
   */
  async update(
    id: string,
    dto: UpdateUnitDto,
    actor?: CurrentUserPayload,
    context?: AuditContext,
  ): Promise<Unit> {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException(`Unit with id "${id}" not found`);
    }

    if (unit.code === OrganizationsService.ROOT_UNIT_CODE && dto.parentId) {
      throw new BadRequestException('SGU must remain a top-level unit.');
    }

    if (dto.parentId !== undefined && !dto.parentId && unit.parentId) {
      throw new BadRequestException(
        'Cannot move unit to root level. SGU is the only top-level unit.',
      );
    }

    // Prevent setting parent to self
    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('A unit cannot be its own parent');
    }

    let newPath = unit.path;
    let newLevel = unit.level;
    let resolvedSortOrder = dto.sortOrder;

    // If parent changed, recalculate path for this unit + descendants
    if (dto.parentId !== undefined && dto.parentId !== unit.parentId) {
      if (dto.parentId) {
        // Prevent circular reference: new parent cannot be a descendant
        const newParent = await this.prisma.unit.findUnique({
          where: { id: dto.parentId },
        });
        if (!newParent) {
          throw new NotFoundException(
            `Parent unit with id "${dto.parentId}" not found`,
          );
        }
        if (!this.isInSguHierarchy(newParent.path)) {
          throw new BadRequestException(
            'Parent unit must belong to SGU hierarchy.',
          );
        }
        if (newParent.path?.startsWith(`${unit.path}.`)) {
          throw new BadRequestException(
            'Cannot set a descendant as parent (circular reference)',
          );
        }
        newPath = `${newParent.path}.${unit.code.toLowerCase()}`;
        newLevel = newParent.level + 1;
      } else {
        // Moving to root
        newPath = unit.code.toLowerCase();
        newLevel = 0;
      }

      // Update descendants' paths
      const oldPath = unit.path;
      if (oldPath) {
        await this.updateDescendantPaths(
          oldPath,
          newPath,
          newLevel - unit.level,
        );
      }

      if (resolvedSortOrder === undefined) {
        resolvedSortOrder = await this.resolveSortOrder(
          dto.parentId || null,
          undefined,
          id,
        );
      }
    }

    const updatedUnit = await this.prisma.unit.update({
      where: { id },
      data: {
        name: dto.name,
        shortName: dto.shortName,
        parentId: dto.parentId !== undefined ? dto.parentId || null : undefined,
        unitType: dto.unitType,
        status: dto.status,
        sortOrder: resolvedSortOrder,
        path: newPath,
        level: newLevel,
      },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'UNIT',
      updatedUnit.id,
      'UPDATE',
      {
        before: {
          name: unit.name,
          shortName: unit.shortName,
          parentId: unit.parentId,
          unitType: unit.unitType,
          status: unit.status,
          sortOrder: unit.sortOrder,
          path: unit.path,
          level: unit.level,
        },
        after: {
          name: updatedUnit.name,
          shortName: updatedUnit.shortName,
          parentId: updatedUnit.parentId,
          unitType: updatedUnit.unitType,
          status: updatedUnit.status,
          sortOrder: updatedUnit.sortOrder,
          path: updatedUnit.path,
          level: updatedUnit.level,
        },
      },
      context,
    );

    return updatedUnit;
  }

  /**
   * DELETE /units/:id â€” soft-delete (set isDeleted/deletedAt)
   */
  async remove(
    id: string,
    actor?: CurrentUserPayload,
    context?: AuditContext,
  ): Promise<Unit> {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { _count: { select: { employees: true, children: true } } },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with id "${id}" not found`);
    }

    if (unit.code === OrganizationsService.ROOT_UNIT_CODE) {
      throw new BadRequestException('Cannot delete SGU root unit.');
    }

    if (unit.isDeleted) {
      throw new BadRequestException('Unit is already soft-deleted.');
    }

    if (unit._count.children > 0) {
      throw new BadRequestException(
        'Cannot deactivate a unit that still has child units.',
      );
    }

    // Prevent deletion if unit has active employees
    if (unit._count.employees > 0) {
      throw new BadRequestException(
        'Cannot deactivate a unit that has active employees. Transfer employees first.',
      );
    }

    const softDeletedUnit = await this.prisma.unit.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await this.auditService.record(
      this.toAuditActor(actor),
      'UNIT',
      softDeletedUnit.id,
      'SOFT_DELETE',
      {
        before: {
          isDeleted: unit.isDeleted,
          deletedAt: unit.deletedAt,
        },
        after: {
          isDeleted: softDeletedUnit.isDeleted,
          deletedAt: softDeletedUnit.deletedAt,
        },
      },
      context,
    );

    return softDeletedUnit;
  }

  /**
   * DELETE /units/:id/hard â€” permanently delete a soft-deleted unit
   */
  async hardRemove(
    id: string,
    actor?: CurrentUserPayload,
    context?: AuditContext,
  ): Promise<Unit> {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true, children: true, userRoles: true },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with id "${id}" not found`);
    }

    if (unit.code === OrganizationsService.ROOT_UNIT_CODE) {
      throw new BadRequestException('Cannot permanently delete SGU root unit.');
    }

    if (!unit.isDeleted) {
      throw new BadRequestException(
        'Only soft-deleted units can be permanently deleted.',
      );
    }

    if (unit._count.children > 0) {
      throw new BadRequestException(
        'Cannot permanently delete a unit that still has child units.',
      );
    }

    if (unit._count.employees > 0) {
      throw new BadRequestException(
        'Cannot permanently delete a unit that still has employees.',
      );
    }

    const [, deletedUnit] = await this.prisma.$transaction([
      this.prisma.userRole.updateMany({
        where: { unitId: id },
        data: { unitId: null },
      }),
      this.prisma.unit.delete({ where: { id } }),
    ]);

    await this.auditService.record(
      this.toAuditActor(actor),
      'UNIT',
      deletedUnit.id,
      'HARD_DELETE',
      {
        before: {
          code: unit.code,
          name: unit.name,
          isDeleted: unit.isDeleted,
          deletedAt: unit.deletedAt,
        },
      },
      context,
    );

    return deletedUnit;
  }

  /**
   * GET /units/:id/employees â€” list employees in a unit
   * Returns basic employee info; full profiles handled by Employee module (Slice 3)
   */
  async getEmployees(unitId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException(`Unit with id "${unitId}" not found`);
    }

    return this.prisma.employee.findMany({
      where: { unitId, status: 'WORKING', deletedAt: null },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        currentPosition: true,
        status: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PRIVATE HELPERS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async resolveSortOrder(
    parentId: string | null,
    requestedSortOrder?: number,
    excludeUnitId?: string,
  ): Promise<number> {
    if (requestedSortOrder !== undefined) {
      return requestedSortOrder;
    }

    const sibling = await this.prisma.unit.findFirst({
      where: {
        parentId,
        ...(excludeUnitId ? { id: { not: excludeUnitId } } : {}),
      },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const currentMax =
      sibling?.sortOrder ?? -OrganizationsService.SORT_ORDER_STEP;
    return currentMax + OrganizationsService.SORT_ORDER_STEP;
  }

  /**
   * Build nested tree from flat list of units
   */
  private buildTree(units: Unit[]): TreeUnitDto[] {
    const map = new Map<string, TreeUnitDto>();
    const roots: TreeUnitDto[] = [];

    // Create map of all nodes
    for (const unit of units) {
      map.set(unit.id, {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        shortName: unit.shortName,
        unitType: unit.unitType,
        status: unit.status,
        isDeleted: unit.isDeleted,
        deletedAt: unit.deletedAt,
        level: unit.level,
        sortOrder: unit.sortOrder,
        parentId: unit.parentId,
        children: [],
      });
    }

    // Build parentâ†’children relationships
    for (const unit of units) {
      const node = map.get(unit.id)!;
      if (unit.parentId && map.has(unit.parentId)) {
        map.get(unit.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Update path and level for all descendants when a parent changes
   */
  private async updateDescendantPaths(
    oldPath: string,
    newPath: string,
    levelDiff: number,
  ): Promise<void> {
    // Find all descendants whose path starts with oldPath.
    const descendants = await this.prisma.unit.findMany({
      where: {
        path: { startsWith: `${oldPath}.` },
      },
    });

    // Batch update each descendant's path and level
    for (const desc of descendants) {
      const updatedPath = desc.path!.replace(oldPath, newPath);
      await this.prisma.unit.update({
        where: { id: desc.id },
        data: {
          path: updatedPath,
          level: desc.level + levelDiff,
        },
      });
    }
  }

  private isInSguHierarchy(path: string | null | undefined): boolean {
    if (!path) {
      return false;
    }

    const normalizedPath = path.toLowerCase();
    return (
      normalizedPath === OrganizationsService.ROOT_PATH_PREFIX ||
      normalizedPath.startsWith(`${OrganizationsService.ROOT_PATH_PREFIX}.`)
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
}
