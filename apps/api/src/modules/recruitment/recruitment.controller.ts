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
} from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUserPayload } from '../../auth/interfaces';
import { PERMISSIONS } from '../../common/constants';
import { CurrentUser, RequirePermissions } from '../../rbac';
import type { AuditContext } from '../audit/audit.service';
import {
  ConvertCandidateDto,
  CreateCampaignDto,
  CreateCandidateDto,
  ListCampaignsQueryDto,
  ListCandidatesQueryDto,
  UpdateCampaignDto,
  UpdateCandidateStatusDto,
} from './dto';
import { RecruitmentService } from './recruitment.service';

@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('campaigns')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  listCampaigns(@Query() query: ListCampaignsQueryDto) {
    return this.recruitmentService.listCampaigns(query);
  }

  @Post('campaigns')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  createCampaign(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.recruitmentService.createCampaign(
      dto,
      user,
      this.getAuditContext(req),
    );
  }

  @Patch('campaigns/:id')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.recruitmentService.updateCampaign(
      id,
      dto,
      user,
      this.getAuditContext(req),
    );
  }

  @Get('campaigns/:id/candidates')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  listCandidates(
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Query() query: ListCandidatesQueryDto,
  ) {
    return this.recruitmentService.listCandidates(campaignId, query);
  }

  @Post('campaigns/:id/candidates')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  createCandidate(
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.recruitmentService.createCandidate(campaignId, dto);
  }

  @Patch('candidates/:id/status')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  updateCandidateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCandidateStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.recruitmentService.updateCandidateStatus(
      id,
      dto,
      user,
      this.getAuditContext(req),
    );
  }

  @Post('candidates/:id/convert')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_CONVERT)
  convertCandidate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertCandidateDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.recruitmentService.convertCandidate(
      id,
      dto,
      user,
      this.getAuditContext(req),
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
}
