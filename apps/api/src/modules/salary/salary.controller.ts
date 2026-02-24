import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RankGroup } from '@prisma/client';
import type { Request, Response } from 'express';
import type { CurrentUserPayload } from '../../auth/interfaces';
import { PERMISSIONS } from '../../common/constants';
import {
  CurrentUser,
  RequireAnyPermissions,
  RequirePermissions,
  SALARY_READ_PERMISSIONS,
} from '../../rbac';
import { JwtAuthGuard } from '../../rbac/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import type { AuditContext } from '../audit/audit.service';
import {
  CreateRankDto,
  CreateRankStepDto,
  CreateSalaryRecordDto,
  UpdateRankDto,
  UpdateRankStepDto,
} from './dto';
import { SalaryService } from './salary.service';

@Controller()
@UseGuards(JwtAuthGuard, RbacGuard)
export class SalaryController {
  constructor(
    private readonly salaryService: SalaryService,
    private readonly config: ConfigService,
  ) {}

  // -- Master Data: Civil Servant Ranks -------------------------------------

  @Get('civil-servant-ranks')
  @RequirePermissions(PERMISSIONS.SALARY_READ)
  listRanks(
    @Query('active') active?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('sectorGroup') sectorGroup?: string,
  ) {
    return this.salaryService.findAllRanks({
      active,
      search,
      category,
      sectorGroup,
    });
  }

  @Get('civil-servant-ranks/sectors')
  @RequirePermissions(PERMISSIONS.SALARY_READ)
  listSectors() {
    return this.salaryService.findDistinctSectors();
  }

  @Post('civil-servant-ranks')
  @RequirePermissions(PERMISSIONS.SALARY_CONFIG_MANAGE)
  createRank(
    @Body() dto: CreateRankDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.salaryService.createRank(
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Patch('civil-servant-ranks/:id')
  @RequirePermissions(PERMISSIONS.SALARY_CONFIG_MANAGE)
  updateRank(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRankDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.salaryService.updateRank(
      id,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Get('salary-scale/:rankGroup/steps')
  @RequirePermissions(PERMISSIONS.SALARY_READ)
  listRankSteps(
    @Param('rankGroup', new ParseEnumPipe(RankGroup)) rankGroup: RankGroup,
    @Query('active') active?: string,
  ) {
    return this.salaryService.findRankSteps(rankGroup, { active });
  }

  @Get('civil-servant-ranks/:rankId/steps')
  @RequirePermissions(PERMISSIONS.SALARY_READ)
  listRankStepsLegacy(
    @Param('rankId', ParseUUIDPipe) rankId: string,
    @Query('active') active: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', this.getLegacyStepsSunset());
    res.setHeader(
      'Link',
      '</salary-scale/{rankGroup}/steps>; rel="successor-version"',
    );
    return this.salaryService.findRankStepsByRankId(rankId, { active });
  }

  @Post('salary-scale/:rankGroup/steps')
  @RequirePermissions(PERMISSIONS.SALARY_CONFIG_MANAGE)
  createRankStep(
    @Param('rankGroup', new ParseEnumPipe(RankGroup)) rankGroup: RankGroup,
    @Body() dto: CreateRankStepDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.salaryService.createRankStep(
      rankGroup,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  @Patch('civil-servant-rank-steps/:id')
  @RequirePermissions(PERMISSIONS.SALARY_CONFIG_MANAGE)
  updateRankStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRankStepDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.salaryService.updateRankStep(
      id,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  // -- Salary Records --------------------------------------------------------

  @Get('employees/:employeeId/salary-records')
  @RequireAnyPermissions(...SALARY_READ_PERMISSIONS)
  listRecords(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.salaryService.findAllRecords(employeeId, user);
  }

  @Post('employees/:employeeId/salary-records')
  @RequirePermissions(PERMISSIONS.SALARY_WRITE)
  createRecord(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateSalaryRecordDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.salaryService.createRecord(
      employeeId,
      dto,
      user,
      this.getAuditContext(req),
      this.getRequestPath(req),
    );
  }

  // -- Helpers ---------------------------------------------------------------

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

  private getLegacyStepsSunset(): string {
    const configured = this.config.get<string>('SALARY_LEGACY_STEPS_SUNSET');
    return configured?.trim() || '2026-12-31';
  }
}
