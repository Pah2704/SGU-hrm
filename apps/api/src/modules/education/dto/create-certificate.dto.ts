import { ApprovalStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCertificateDto {
  @IsString()
  name: string;

  @IsString()
  issuedBy: string;

  @IsDateString()
  @IsOptional()
  issuedDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsEnum(ApprovalStatus)
  @IsOptional()
  status?: ApprovalStatus;
}
