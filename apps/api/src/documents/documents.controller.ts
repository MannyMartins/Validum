import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';
@UseGuards(JwtAuthGuard)
@Controller('cases/:caseId/documents')
export class DocumentsController { constructor(private documents: DocumentsService) {} @Get() list(@Param('caseId') caseId: string) { return this.documents.listForCase(caseId); } }
