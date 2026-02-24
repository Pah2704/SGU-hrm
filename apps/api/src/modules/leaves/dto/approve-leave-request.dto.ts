import { ApprovalStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

const APPROVABLE_STATUSES = [
  ApprovalStatus.APPROVED,
  ApprovalStatus.REJECTED,
] as const;

export class ApproveLeaveRequestDto {
  @IsEnum(ApprovalStatus)
  @IsIn(APPROVABLE_STATUSES)
  status: ApprovalStatus;

  @IsString()
  @IsOptional()
  note?: string;
}
