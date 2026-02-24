import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateRankStepDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  level: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  coefficient: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
