import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { RecruitmentCampaignStatus } from '@prisma/client';

export class CreateCampaignDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  unitId: string;

  @IsUUID()
  @IsOptional()
  positionId?: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  @IsOptional()
  quantity?: number;

  @IsDateString()
  deadline: string;

  @IsEnum(RecruitmentCampaignStatus)
  @IsOptional()
  status?: RecruitmentCampaignStatus;
}
