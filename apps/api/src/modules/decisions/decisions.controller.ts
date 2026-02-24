import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { DecisionsService } from './decisions.service';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { CurrentUser, RequirePermissions } from '../../rbac';
import { PERMISSIONS } from '../../common/constants/permissions';
import type { CurrentUserPayload } from '../../auth/interfaces';
import type { AuditContext } from '../audit/audit.service';

@Controller()
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Post('decisions')
  @RequirePermissions(PERMISSIONS.DECISIONS_WRITE)
  create(
    @Body() createDecisionDto: CreateDecisionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.decisionsService.create(
      createDecisionDto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Get('employees/:employeeId/decisions')
  @RequirePermissions(PERMISSIONS.DECISIONS_READ)
  findAllByEmployee(@Param('employeeId') employeeId: string) {
    return this.decisionsService.findAllByEmployee(employeeId);
  }

  @Patch('decisions/:id')
  @RequirePermissions(PERMISSIONS.DECISIONS_WRITE)
  update(
    @Param('id') id: string,
    @Body() updateDecisionDto: UpdateDecisionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.decisionsService.update(
      id,
      updateDecisionDto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Delete('decisions/:id')
  @RequirePermissions(PERMISSIONS.DECISIONS_WRITE)
  remove(@Param('id') id: string) {
    return this.decisionsService.remove(id);
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
