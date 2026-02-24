import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUserPayload } from '../../auth/interfaces';
import { PERMISSIONS } from '../../common/constants';
import {
  CurrentUser,
  EDUCATION_READ_ACCESS_PERMISSIONS,
  EDUCATION_WRITE_ACCESS_PERMISSIONS,
  RequireAnyPermissions,
  RequirePermissions,
} from '../../rbac';
import { JwtAuthGuard } from '../../rbac/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import type { AuditContext } from '../audit/audit.service';
import {
  ApproveCertificateDto,
  ApproveDegreeDto,
  CreateCertificateDto,
  CreateDegreeDto,
} from './dto';
import { EducationService } from './education.service';

@Controller()
@UseGuards(JwtAuthGuard, RbacGuard)
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  @Get('employees/:employeeId/degrees')
  @RequireAnyPermissions(...EDUCATION_READ_ACCESS_PERMISSIONS)
  listDegrees(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.educationService.listDegrees(employeeId, user);
  }

  @Post('employees/:employeeId/degrees')
  @RequireAnyPermissions(...EDUCATION_WRITE_ACCESS_PERMISSIONS)
  createDegree(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateDegreeDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.educationService.createDegree(
      employeeId,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Patch('degrees/:id/approve')
  @RequirePermissions(PERMISSIONS.EDUCATION_APPROVE)
  approveDegree(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDegreeDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.educationService.approveDegree(
      id,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Get('employees/:employeeId/certificates')
  @RequireAnyPermissions(...EDUCATION_READ_ACCESS_PERMISSIONS)
  listCertificates(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.educationService.listCertificates(employeeId, user);
  }

  @Post('employees/:employeeId/certificates')
  @RequireAnyPermissions(...EDUCATION_WRITE_ACCESS_PERMISSIONS)
  createCertificate(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateCertificateDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.educationService.createCertificate(
      employeeId,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Patch('certificates/:id/approve')
  @RequirePermissions(PERMISSIONS.EDUCATION_APPROVE)
  approveCertificate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveCertificateDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.educationService.approveCertificate(
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
