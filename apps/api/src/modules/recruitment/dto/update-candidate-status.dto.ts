import { IsEnum } from 'class-validator';
import { CandidateStatus } from '@prisma/client';

export class UpdateCandidateStatusDto {
  @IsEnum(CandidateStatus)
  status: CandidateStatus;
}
