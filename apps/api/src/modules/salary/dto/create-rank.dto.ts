import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { RankGroup } from '@prisma/client';

export class CreateRankDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  rankType?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsEnum(RankGroup)
  rankGroup: RankGroup;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minCoefficient?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCoefficient?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  legalReference?: string;

  @IsOptional()
  @IsString()
  replacedByCode?: string;
}
