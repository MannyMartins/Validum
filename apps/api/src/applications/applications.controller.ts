import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApplicationType, Prisma } from '@prisma/client';
import { IsEmail, IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicationsService } from './applications.service';
class CreateEmployeeDto {
  @IsString() documentType!: string; @IsString() documentNumber!: string;
  @IsString() firstName!: string; @IsOptional() @IsString() middleName?: string;
  @IsString() firstSurname!: string; @IsOptional() @IsString() secondSurname?: string;
  @IsOptional() @IsISO8601() birthDate?: string; @IsOptional() @IsString() sex?: string;
  @IsOptional() @IsString() genderIdentity?: string; @IsOptional() @IsString() epsName?: string;
  @IsOptional() @IsString() arlName?: string; @IsOptional() @IsString() pensionFund?: string;
  @IsOptional() @IsString() mobilePhone?: string; @IsOptional() @IsEmail() email?: string;
}
class CreateApplicationDto { @IsString() employeeId!: string; @IsOptional() @IsString() companyId?: string; @IsOptional() @IsString() templateId?: string; @IsEnum(ApplicationType) type!: ApplicationType; }
@UseGuards(JwtAuthGuard)
@Controller()
export class ApplicationsController {
  constructor(private applications: ApplicationsService) {}
  @Get('employees') listEmployees() { return this.applications.listEmployees(); }
  @Post('employees') createEmployee(@Body() dto: CreateEmployeeDto) { return this.applications.createEmployee({ ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined } as Prisma.EmployeeCreateInput); }
  @Get('applications') listApplications() { return this.applications.listApplications(); }
  @Post('applications') createApplication(@Body() dto: CreateApplicationDto) { return this.applications.createApplication(dto); }
}
