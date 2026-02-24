import { ApprovalStatus, DegreeType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateDegreeDto {
  @IsEnum(DegreeType)
  degreeType: DegreeType;

  @IsString()
  major: string;

  @IsString()
  institution: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  graduationYear: number;

  @IsString()
  @IsOptional()
  degreeNumber?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsEnum(ApprovalStatus)
  @IsOptional()
  status?: ApprovalStatus;
}
