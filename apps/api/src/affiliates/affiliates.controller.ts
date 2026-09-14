import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsDateString, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AffiliatesService } from './affiliates.service';

class AffiliateDto {
  @IsOptional() @IsString() companyId?: string;
  @IsString() @IsNotEmpty() documentType!: string;
  @IsString() @IsNotEmpty() documentNumber!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsOptional() @IsString() middleName?: string;
  @IsString() @IsNotEmpty() firstSurname!: string;
  @IsOptional() @IsString() secondSurname?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() sex?: string;
  @IsOptional() @IsString() genderIdentity?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() birthCountry?: string;
  @IsOptional() @IsString() birthDepartment?: string;
  @IsOptional() @IsString() birthCity?: string;
  @IsOptional() @IsString() issueCountry?: string;
  @IsOptional() @IsString() issueDepartment?: string;
  @IsOptional() @IsString() issueCity?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsString() residenceDepartment?: string;
  @IsOptional() @IsString() residenceCity?: string;
  @IsOptional() @IsString() residenceType?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() municipalityCode?: string;
  @IsOptional() @IsString() departmentCode?: string;
  @IsOptional() @IsString() mobilePhone?: string;
  @IsOptional() @IsString() landlinePhone?: string;
  @IsOptional() @IsString() localityCommune?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() epsName?: string;
  @IsOptional() @IsString() epsCode?: string;
  @IsOptional() @IsString() arlName?: string;
  @IsOptional() @IsNumber() @Min(1) arlRiskLevel?: number;
  @IsOptional() @IsString() pensionFund?: string;
  @IsOptional() @IsString() compensationFund?: string;
  @IsOptional() @IsString() affiliationType?: string;
  @IsOptional() @IsString() affiliationMode?: string;
  @IsOptional() @IsString() healthRegime?: string;
  @IsOptional() @IsString() affiliateType?: string;
  @IsOptional() @IsString() epsRegistrationCode?: string;
  @IsOptional() @IsString() noveltyType?: string;
  @IsOptional() @IsString() mobilityRegime?: string;
  @IsOptional() @IsString() transferRegime?: string;
  @IsOptional() @IsDateString() noveltyDate?: string;
  @IsOptional() @IsString() previousEps?: string;
  @IsOptional() @IsString() transferReason?: string;
  @IsOptional() @IsString() previousCompensationFund?: string;
  @IsOptional() @IsString() contributorType?: string;
  @IsOptional() @IsString() contributorTypeCode?: string;
  @IsOptional() @IsString() contributorSubtype?: string;
  @IsOptional() @IsString() satRequest?: string;
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsString() disability?: string;
  @IsOptional() @IsNumber() @Min(0) sisbenScore?: number;
  @IsOptional() @IsString() specialGroup?: string;
  @IsOptional() @IsString() condition?: string;
  @IsOptional() @IsNumber() @Min(0) salary?: number;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() workDepartment?: string;
  @IsOptional() @IsString() selectedIps?: string;
  @IsOptional() @IsString() ipsCode?: string;
  @IsOptional() @IsDateString() startDate?: string;
}

class BeneficiaryDto {
  @IsString() relationship!: string;
  @IsString() documentType!: string;
  @IsString() documentNumber!: string;
  @IsString() firstName!: string;
  @IsOptional() @IsString() middleName?: string;
  @IsString() firstSurname!: string;
  @IsOptional() @IsString() secondSurname?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() sex?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() birthCountry?: string;
  @IsOptional() @IsString() birthDepartment?: string;
  @IsOptional() @IsString() birthCity?: string;
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsString() disability?: string;
  @IsOptional() @IsString() condition?: string;
  @IsOptional() @IsString() residenceCity?: string;
  @IsOptional() @IsString() residenceZone?: string;
  @IsOptional() @IsString() residenceDepartment?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsNumber() @Min(0) upcValue?: number;
  @IsOptional() @IsString() selectedIps?: string;
  @IsOptional() @IsString() ipsCode?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('affiliates')
export class AffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}
  @Get() list(@Query('companyId') companyId?: string) { return this.affiliates.list(companyId); }
  @Get(':id') findOne(@Param('id') id: string) { return this.affiliates.findOne(id); }
  @Post() create(@Body() dto: AffiliateDto) { return this.affiliates.create(this.normalizeAffiliate(dto)); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: Partial<AffiliateDto>) { return this.affiliates.update(id, this.normalizeAffiliate(dto)); }
  @Post(':id/beneficiaries') addBeneficiary(@Param('id') id: string, @Body() dto: BeneficiaryDto) { return this.affiliates.addBeneficiary(id, this.normalizeBeneficiary(dto)); }
  @Patch(':id/beneficiaries/:beneficiaryId') updateBeneficiary(@Param('id') id: string, @Param('beneficiaryId') beneficiaryId: string, @Body() dto: Partial<BeneficiaryDto>) { return this.affiliates.updateBeneficiary(id, beneficiaryId, this.normalizeBeneficiary(dto)); }
  @Delete(':id/beneficiaries/:beneficiaryId') removeBeneficiary(@Param('id') id: string, @Param('beneficiaryId') beneficiaryId: string) { return this.affiliates.removeBeneficiary(id, beneficiaryId); }

  private normalizeAffiliate(dto: AffiliateDto): Prisma.EmployeeUncheckedCreateInput;
  private normalizeAffiliate(dto: Partial<AffiliateDto>): Prisma.EmployeeUncheckedUpdateInput;
  private normalizeAffiliate(dto: Partial<AffiliateDto>): any {
    return {
      ...dto,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      noveltyDate: dto.noveltyDate ? new Date(dto.noveltyDate) : undefined,
    };
  }

  private normalizeBeneficiary(dto: BeneficiaryDto): Omit<Prisma.BeneficiaryUncheckedCreateInput, 'employeeId'>;
  private normalizeBeneficiary(dto: Partial<BeneficiaryDto>): Prisma.BeneficiaryUncheckedUpdateInput;
  private normalizeBeneficiary(dto: Partial<BeneficiaryDto>): any {
    return {
      ...dto,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
    };
  }
}
