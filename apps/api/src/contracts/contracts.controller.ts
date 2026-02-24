import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { JwtAuthGuard } from '../rbac/guards/jwt-auth.guard';
import { RbacGuard } from '../rbac/guards/rbac.guard';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../rbac/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/interfaces';
import { PERMISSIONS } from '../common/constants';
import type { AuditContext } from '../modules/audit/audit.service';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  create(
    @Body() createContractDto: CreateContractDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.contractsService.create(
      createContractDto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CONTRACTS_READ)
  findAll(@Query('employeeId') employeeId?: string) {
    return this.contractsService.findAll(employeeId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CONTRACTS_READ)
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.contractsService.update(
      id,
      updateContractDto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  remove(@Param('id') id: string) {
    return this.contractsService.remove(id);
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
