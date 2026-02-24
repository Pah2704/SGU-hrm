import {
  BadRequestException,
  Module,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth';
import { RbacModule } from './rbac';
import { UsersModule } from './users';
import { OrganizationsModule } from './organizations';
import { EmployeesModule } from './employees/employees.module';
import { ContractsModule } from './contracts/contracts.module';
import { PositionsModule } from './modules/positions/positions.module';
import { DecisionsModule } from './modules/decisions/decisions.module';
import { AuditModule } from './modules/audit/audit.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { EducationModule } from './modules/education/education.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { SalaryModule } from './modules/salary/salary.module';

const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath = '',
): Array<{ field: string; message: string }> => {
  const result: Array<{ field: string; message: string }> = [];

  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    for (const message of Object.values(error.constraints ?? {})) {
      result.push({ field, message });
    }

    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, field));
    }
  }

  return result;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    RbacModule,
    UsersModule,
    OrganizationsModule,
    EmployeesModule,
    ContractsModule,
    PositionsModule,
    DecisionsModule,
    AuditModule,
    RecruitmentModule,
    EducationModule,
    LeavesModule,
    SalaryModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global validation pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors: ValidationError[] = []) =>
          new BadRequestException({
            message: 'Validation failed',
            errors: flattenValidationErrors(errors),
          }),
      }),
    },
  ],
})
export class AppModule {}
