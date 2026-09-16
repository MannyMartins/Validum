import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { SessionPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceService } from './workspace.service';
class ItemsDto { @IsArray() items!: unknown[]; }
class ActiveCompanyDto { @IsOptional() @IsString() activeCompanyId!: string | null; }
class RecordDto { @IsObject() record!: Record<string, unknown>; }
class AffiliationFolioDto {
  @IsObject() company!: Record<string, unknown>;
  @IsObject() employee!: Record<string, unknown>;
}
@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private workspace: WorkspaceService) {}
  private assertCanWrite(role: string) {
    if (!['owner', 'admin', 'operator'].includes(role)) {
      throw new ForbiddenException('Tu rol solo permite consultar la información.');
    }
  }
  @Get() bootstrap(@Req() req: { user: SessionPayload }) { return this.workspace.bootstrap(req.user.organizationId); }
  @Put('companies') companies(@Req() req: { user: SessionPayload }, @Body() body: ItemsDto) { this.assertCanWrite(req.user.membershipRole); return this.workspace.replace(req.user.organizationId, 'companies', body.items); }
  @Put('employees') employees(@Req() req: { user: SessionPayload }, @Body() body: ItemsDto) { this.assertCanWrite(req.user.membershipRole); return this.workspace.replace(req.user.organizationId, 'employees', body.items); }
  @Put('active-company') activeCompany(@Req() req: { user: SessionPayload }, @Body() body: ActiveCompanyDto) { this.assertCanWrite(req.user.membershipRole); return this.workspace.setActiveCompany(req.user.organizationId, body.activeCompanyId); }
  @Post('affiliation-folios') affiliationFolio(@Req() req: { user: SessionPayload }, @Body() body: AffiliationFolioDto) {
    this.assertCanWrite(req.user.membershipRole);
    return this.workspace.saveAffiliationFolio(req.user.organizationId, body.company, body.employee);
  }
  @Get('affiliation-drafts') affiliationDrafts(@Req() req: { user: SessionPayload }) {
    return this.workspace.listAffiliationDrafts(req.user.organizationId);
  }
  @Put('affiliation-drafts/:id') saveAffiliationDraft(@Req() req: { user: SessionPayload }, @Param('id') id: string, @Body() body: RecordDto) {
    this.assertCanWrite(req.user.membershipRole);
    return this.workspace.saveAffiliationDraft(req.user.organizationId, { ...body.record, id });
  }
  @Delete('affiliation-drafts/:id') removeAffiliationDraft(@Req() req: { user: SessionPayload }, @Param('id') id: string) {
    this.assertCanWrite(req.user.membershipRole);
    return this.workspace.removeAffiliationDraft(req.user.organizationId, id);
  }
  @Put('records/:collection/:id') save(@Req() req: { user: SessionPayload }, @Param('collection') collection: 'templates' | 'generatedForms' | 'stampPresets', @Param('id') id: string, @Body() body: RecordDto) {
    this.assertCanWrite(req.user.membershipRole); return this.workspace.saveRecord(req.user.organizationId, collection, { ...body.record, id });
  }
  @Delete('records/:collection/:id') remove(@Req() req: { user: SessionPayload }, @Param('collection') collection: 'templates' | 'generatedForms' | 'stampPresets', @Param('id') id: string) {
    this.assertCanWrite(req.user.membershipRole); return this.workspace.removeRecord(req.user.organizationId, collection, id);
  }
  @Get('support-documents/list') supports(@Req() req: { user: SessionPayload }) { return this.workspace.listSupportDocuments(req.user.organizationId); }
  @Post('support-documents') createSupport(@Req() req: { user: SessionPayload }, @Body() body: RecordDto) {
    this.assertCanWrite(req.user.membershipRole); return this.workspace.createSupportDocument(req.user.organizationId, req.user.sub, body.record);
  }
  @Patch('support-documents/:id') updateSupport(@Req() req: { user: SessionPayload }, @Param('id') id: string, @Body() body: RecordDto) {
    this.assertCanWrite(req.user.membershipRole); return this.workspace.updateSupportDocument(req.user.organizationId, id, body.record);
  }
  @Get('support-documents/:id/content') supportContent(@Req() req: { user: SessionPayload }, @Param('id') id: string) {
    return this.workspace.supportDocumentContent(req.user.organizationId, id);
  }
  @Delete('support-documents/:id') removeSupport(@Req() req: { user: SessionPayload }, @Param('id') id: string) {
    this.assertCanWrite(req.user.membershipRole); return this.workspace.removeSupportDocument(req.user.organizationId, id);
  }
}
