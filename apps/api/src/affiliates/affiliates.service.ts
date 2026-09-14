import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.module';

const expediente = { company: true, beneficiaries: true, documents: { orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class AffiliatesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(companyId?: string) {
    return this.prisma.employee.findMany({ where: companyId ? { companyId } : undefined, include: expediente, orderBy: { updatedAt: 'desc' } });
  }

  async findOne(id: string) {
    const affiliate = await this.prisma.employee.findUnique({ where: { id }, include: expediente });
    if (!affiliate) throw new NotFoundException('Afiliado no encontrado.');
    return affiliate;
  }

  async create(data: Prisma.EmployeeUncheckedCreateInput) {
    try {
      const affiliate = await this.prisma.employee.create({ data, include: expediente });
      await this.audit.log({ action: 'affiliate.created', entityType: 'Employee', entityId: affiliate.id, metadata: { documentNumber: affiliate.documentNumber } });
      return affiliate;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Ya existe un afiliado con este número de documento.');
      throw error;
    }
  }

  async update(id: string, data: Prisma.EmployeeUncheckedUpdateInput) {
    await this.findOne(id);
    const affiliate = await this.prisma.employee.update({ where: { id }, data, include: expediente });
    await this.audit.log({ action: 'affiliate.updated', entityType: 'Employee', entityId: id });
    return affiliate;
  }

  async addBeneficiary(employeeId: string, data: Omit<Prisma.BeneficiaryUncheckedCreateInput, 'employeeId'>) {
    await this.findOne(employeeId);
    const beneficiary = await this.prisma.beneficiary.create({ data: { ...data, employeeId } });
    await this.audit.log({ action: 'affiliate.beneficiary_added', entityType: 'Beneficiary', entityId: beneficiary.id, metadata: { employeeId } });
    return beneficiary;
  }

  async updateBeneficiary(employeeId: string, beneficiaryId: string, data: Prisma.BeneficiaryUncheckedUpdateInput) {
    const beneficiary = await this.prisma.beneficiary.findFirst({ where: { id: beneficiaryId, employeeId } });
    if (!beneficiary) throw new NotFoundException('Beneficiario no encontrado para este afiliado.');
    const updated = await this.prisma.beneficiary.update({ where: { id: beneficiaryId }, data });
    await this.audit.log({ action: 'affiliate.beneficiary_updated', entityType: 'Beneficiary', entityId: beneficiaryId, metadata: { employeeId } });
    return updated;
  }

  async removeBeneficiary(employeeId: string, beneficiaryId: string) {
    const beneficiary = await this.prisma.beneficiary.findFirst({ where: { id: beneficiaryId, employeeId } });
    if (!beneficiary) throw new NotFoundException('Beneficiario no encontrado para este afiliado.');
    await this.prisma.beneficiary.delete({ where: { id: beneficiaryId } });
    await this.audit.log({ action: 'affiliate.beneficiary_removed', entityType: 'Beneficiary', entityId: beneficiaryId, metadata: { employeeId } });
    return { deleted: true };
  }
}
