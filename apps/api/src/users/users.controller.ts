import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { CurrentUser, RequirePermissions, Roles } from '../rbac';
import { PERMISSIONS, ROLES } from '../common/constants';
import type { CurrentUserPayload } from '../auth/interfaces';
import { AuthService } from '../auth';
import type { AuditContext } from '../modules/audit/audit.service';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}

  /**
   * GET /users
   * List all users (admin only)
   */
  @Get()
  @RequirePermissions(PERMISSIONS.SYSTEM_USERS_MANAGE)
  findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.usersService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  /**
   * GET /users/me
   * Get current user profile (any authenticated user)
   */
  @Get('me')
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getProfile(user.userId);
  }

  /**
   * GET /users/:id
   * Get user by ID (admin only)
   */
  @Get(':id')
  @RequirePermissions(PERMISSIONS.SYSTEM_USERS_MANAGE)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * POST /users
   * Create new user (admin only)
   */
  @Post()
  @RequirePermissions(PERMISSIONS.SYSTEM_USERS_MANAGE)
  @Roles(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.usersService.create(
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  /**
   * PATCH /users/:id
   * Update user (admin only)
   */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SYSTEM_USERS_MANAGE)
  @Roles(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.usersService.update(
      id,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  /**
   * DELETE /users/:id
   * Deactivate user (admin only)
   */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SYSTEM_USERS_MANAGE)
  @Roles(ROLES.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  private getAuditContext(req: Request): AuditContext {
    const requestWithId = req as Request & { requestId?: string };
    return {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      requestId: requestWithId.requestId ?? req.get('x-request-id') ?? null,
    };
  }

  private getRequestPath(req: Request): string {
    return req.originalUrl ?? req.url;
  }
}
