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
import { PositionsService } from './positions.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CurrentUser, RequirePermissions } from '../../rbac';
import { PERMISSIONS } from '../../common/constants/permissions';
import type { CurrentUserPayload } from '../../auth/interfaces';
import type { AuditContext } from '../audit/audit.service';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.POSITIONS_WRITE)
  create(
    @Body() createPositionDto: CreatePositionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.positionsService.create(
      createPositionDto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.POSITIONS_READ)
  findAll() {
    return this.positionsService.findAll();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.POSITIONS_READ)
  findOne(@Param('id') id: string) {
    return this.positionsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.POSITIONS_WRITE)
  update(
    @Param('id') id: string,
    @Body() updatePositionDto: UpdatePositionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.positionsService.update(
      id,
      updatePositionDto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.POSITIONS_WRITE)
  remove(@Param('id') id: string) {
    return this.positionsService.remove(id);
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
