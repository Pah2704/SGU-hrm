import { Module } from '@nestjs/common';
import { EmployeesModule } from '../../employees/employees.module';
import { PrismaModule } from '../../prisma';
import { PublicRecruitmentController } from './public-recruitment.controller';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';

@Module({
  imports: [PrismaModule, EmployeesModule],
  controllers: [RecruitmentController, PublicRecruitmentController],
  providers: [RecruitmentService],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}
