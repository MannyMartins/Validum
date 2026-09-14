import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@UseGuards(JwtAuthGuard)
@Controller('cases')
export class CasesController {
  constructor(private prisma: PrismaService) {}
  @Get() list() { return this.prisma.case.findMany({ include: { contact: true, documents: true }, orderBy: { updatedAt: 'desc' }, take: 100 }); }
}
