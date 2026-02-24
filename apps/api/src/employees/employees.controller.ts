import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { JwtAuthGuard } from '../rbac/guards/jwt-auth.guard';
import { RbacGuard } from '../rbac/guards/rbac.guard';
import {
  EMPLOYEE_READ_PERMISSIONS,
  CurrentUser,
  RequireAnyPermissions,
  RequirePermissions,
} from '../rbac';
import type { CurrentUserPayload } from '../auth/interfaces';
import { PERMISSIONS } from '../common/constants';
import { EmployeeStatus } from '@prisma/client';
import type { AuditContext } from '../modules/audit/audit.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.employeesService.create(
      createEmployeeDto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Get()
  @RequireAnyPermissions(...EMPLOYEE_READ_PERMISSIONS)
  findAll(
    @Query() query: EmployeeQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.employeesService.findAll(query, user);
  }

  @Get(':id')
  @RequireAnyPermissions(...EMPLOYEE_READ_PERMISSIONS)
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.employeesService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.employeesService.update(
      id,
      updateEmployeeDto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: EmployeeStatus,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.employeesService.updateStatus(
      id,
      status,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.employeesService.remove(
      id,
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
