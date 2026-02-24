import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSalaryRecordDto {
  @IsUUID()
  civilServantRankId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  salaryLevel: number;

  // Backward compatibility: accepted but ignored.
  @IsOptional()
  @IsNumber()
  @Min(0)
  coefficient?: number;

  @IsDateString()
  currentLevelDate: string;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsString()
  decisionNo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  percentEnjoy?: number;

  @IsOptional()
  @IsNumber()
  seniorityAllowance?: number;

  @IsOptional()
  @IsNumber()
  positionAllowance?: number;

  @IsOptional()
  @IsNumber()
  concurrentAllowance?: number;

  @IsOptional()
  @IsNumber()
  otherAllowance?: number;
}
