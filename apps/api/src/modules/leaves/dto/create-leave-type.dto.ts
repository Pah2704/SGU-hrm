import { LeaveCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(2)
  code: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(LeaveCategory)
  category: LeaveCategory;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  maxDays?: number;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @IsBoolean()
  @IsOptional()
  seniorityCount?: boolean;

  @IsBoolean()
  @IsOptional()
  delaySalaryRaise?: boolean;
}
