import { ApprovalStatus } from '@prisma/client';
import { IsEnum, IsIn } from 'class-validator';

const APPROVEABLE_CERTIFICATE_STATUS = [
  ApprovalStatus.APPROVED,
  ApprovalStatus.REJECTED,
] as const;

export class ApproveCertificateDto {
  @IsEnum(ApprovalStatus)
  @IsIn(APPROVEABLE_CERTIFICATE_STATUS)
  status: ApprovalStatus;
}
