import { PartialType } from '@nestjs/mapped-types';
import { CreateRankStepDto } from './create-rank-step.dto';

export class UpdateRankStepDto extends PartialType(CreateRankStepDto) {}
