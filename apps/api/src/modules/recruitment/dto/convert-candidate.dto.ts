import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EmployeeStatus, Gender } from '@prisma/client';

export class ConvertCandidateDto {
  @IsString()
  employeeCode: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  citizenId?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsDateString()
  @IsOptional()
  initialRecruitmentDate?: string;

  @IsDateString()
  @IsOptional()
  currentOrgJoinDate?: string;

  @IsDateString()
  @IsOptional()
  officialDate?: string;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  employeeStatus?: EmployeeStatus;
}
