import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Public } from '../../rbac';
import { CreateCandidateDto } from './dto';
import { RecruitmentService } from './recruitment.service';

@Controller('public/recruitment')
@Public()
export class PublicRecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get()
  listCampaigns() {
    return this.recruitmentService.listPublicCampaigns();
  }

  @Post(':campaignId/apply')
  apply(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.recruitmentService.applyPublic(campaignId, dto);
  }
}
