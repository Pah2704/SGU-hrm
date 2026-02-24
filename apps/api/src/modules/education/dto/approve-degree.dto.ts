import { ApprovalStatus } from '@prisma/client';
import { IsEnum, IsIn } from 'class-validator';

const APPROVEABLE_DEGREE_STATUS = [
  ApprovalStatus.APPROVED,
  ApprovalStatus.REJECTED,
] as const;

export class ApproveDegreeDto {
  @IsEnum(ApprovalStatus)
  @IsIn(APPROVEABLE_DEGREE_STATUS)
  status: ApprovalStatus;
}
