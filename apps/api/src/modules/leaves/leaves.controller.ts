import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUserPayload } from '../../auth/interfaces';
import { PERMISSIONS } from '../../common/constants';
import {
  CurrentUser,
  LEAVE_CREATE_REQUEST_PERMISSIONS,
  LEAVE_QUEUE_ACCESS_PERMISSIONS,
  LEAVE_READ_PERMISSIONS,
  LEAVE_TYPE_ACCESS_PERMISSIONS,
  RequireAnyPermissions,
  RequirePermissions,
} from '../../rbac';
import { JwtAuthGuard } from '../../rbac/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import type { AuditContext } from '../audit/audit.service';
import {
  ApproveLeaveRequestDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  ListLeaveRequestsQueryDto,
  UpdateLeaveTypeDto,
} from './dto';
import { LeavesService } from './leaves.service';

@Controller()
@UseGuards(JwtAuthGuard, RbacGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get('leave-types')
  @RequireAnyPermissions(...LEAVE_TYPE_ACCESS_PERMISSIONS)
  listLeaveTypes(@CurrentUser() user: CurrentUserPayload) {
    return this.leavesService.listLeaveTypes(user);
  }

  @Post('leave-types')
  @RequirePermissions(PERMISSIONS.LEAVES_APPROVE)
  createLeaveType(
    @Body() dto: CreateLeaveTypeDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.leavesService.createLeaveType(
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Patch('leave-types/:id')
  @RequirePermissions(PERMISSIONS.LEAVES_APPROVE)
  updateLeaveType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.leavesService.updateLeaveType(
      id,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Get('employees/:employeeId/leave-requests')
  @RequireAnyPermissions(...LEAVE_READ_PERMISSIONS)
  listEmployeeLeaveRequests(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: ListLeaveRequestsQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leavesService.listEmployeeLeaveRequests(
      employeeId,
      query,
      user,
    );
  }

  @Post('employees/:employeeId/leave-requests')
  @RequireAnyPermissions(...LEAVE_CREATE_REQUEST_PERMISSIONS)
  createLeaveRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.leavesService.createLeaveRequest(
      employeeId,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Get('leave-requests')
  @RequireAnyPermissions(...LEAVE_QUEUE_ACCESS_PERMISSIONS)
  listApprovalQueue(
    @Query() query: ListLeaveRequestsQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leavesService.listApprovalQueue(query, user);
  }

  @Patch('leave-requests/:id/approve')
  @RequirePermissions(PERMISSIONS.LEAVES_APPROVE)
  approveLeaveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveLeaveRequestDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.leavesService.approveLeaveRequest(
      id,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
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
