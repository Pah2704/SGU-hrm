import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrganizationsService, TreeUnitDto } from './organizations.service';
import { CreateUnitDto, UpdateUnitDto } from './dto';
import { CurrentUser, RequirePermissions, Roles } from '../rbac';
import { PERMISSIONS } from '../common/constants/permissions';
import { ROLES } from '../common/constants/enums';
import type { CurrentUserPayload } from '../auth/interfaces';
import type { AuditContext } from '../modules/audit/audit.service';

@Controller('units')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  /**
   * GET /units
   * Return the full organization tree (nested structure)
   */
  @Get()
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  getTree(
    @Query('includeSoftDeleted') includeSoftDeleted?: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<TreeUnitDto[]> {
    const requestIncludeSoftDeleted = includeSoftDeleted === 'true';
    const isAdmin = Boolean(
      user?.roles?.includes(ROLES.HR_ADMIN) ||
        user?.roles?.includes(ROLES.SUPER_ADMIN),
    );

    return this.orgService.getTree({
      includeSoftDeleted: requestIncludeSoftDeleted && isAdmin,
    });
  }

  /**
   * GET /units/:id
   * Get single unit detail with parent + children
   */
  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgService.findOne(id);
  }

  /**
   * POST /units
   * Create a new unit with auto-computed path and level
   */
  @Post()
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_WRITE)
  @Roles(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN)
  create(
    @Body() dto: CreateUnitDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.orgService.create(dto, user, this.getAuditContext(req));
  }

  /**
   * PATCH /units/:id
   * Update unit, recalculate path if parent changed
   */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_WRITE)
  @Roles(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.orgService.update(id, dto, user, this.getAuditContext(req));
  }

  /**
   * DELETE /units/:id
   * Soft-delete a unit (set isDeleted/deletedAt)
   */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_WRITE)
  @Roles(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.orgService.remove(id, user, this.getAuditContext(req));
  }

  /**
   * DELETE /units/:id/hard
   * Permanently delete a unit that was already soft-deleted
   */
  @Delete(':id/hard')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_WRITE)
  @Roles(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN)
  hardRemove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.orgService.hardRemove(id, user, this.getAuditContext(req));
  }

  /**
   * GET /units/:id/employees
   * List employees in a unit (placeholder until Slice 3)
   */
  @Get(':id/employees')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  getEmployees(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgService.getEmployees(id);
  }

  private getAuditContext(req: Request): AuditContext {
    const requestWithId = req as Request & { requestId?: string };
    return {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      requestId: requestWithId.requestId ?? req.get('x-request-id') ?? null,
    };
  }
}
