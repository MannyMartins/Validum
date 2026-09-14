import { Injectable } from '@nestjs/common';
import { ApplicationType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.module';
import { AuditService } from '../audit/audit.service';
@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  createEmployee(input: Prisma.EmployeeCreateInput) { return this.prisma.employee.create({ data: input }); }
  listEmployees() { return this.prisma.employee.findMany({ include: { company: true, beneficiaries: true }, orderBy: { createdAt: 'desc' } }); }
  async createApplication(input: { employeeId: string; companyId?: string; templateId?: string; type: ApplicationType; formData?: Record<string, unknown> }) {
    const application = await this.prisma.application.create({ data: { ...input, reference: `SOL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 6).toUpperCase()}`, formData: input.formData as Prisma.InputJsonValue } });
    await this.audit.log({ action: 'application.created', entityType: 'Application', entityId: application.id, metadata: { type: application.type, employeeId: input.employeeId } });
    return application;
  }
  listApplications() { return this.prisma.application.findMany({ include: { employee: true, company: true, template: true }, orderBy: { updatedAt: 'desc' } }); }
}
