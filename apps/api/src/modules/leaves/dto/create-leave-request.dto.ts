import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateLeaveRequestDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsUUID()
  leaveTypeId: string;

  @IsString()
  @MinLength(3)
  @IsOptional()
  reason?: string;
}
