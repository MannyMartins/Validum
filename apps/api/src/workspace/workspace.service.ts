import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.module';
import { StorageService } from '../documents/storage.service';
import { randomUUID } from 'node:crypto';

type JsonRecord = Record<string, unknown>;
type WorkspaceCollection = 'companies' | 'employees' | 'templates' | 'generatedForms' | 'stampPresets';

@Injectable()
export class WorkspaceService {
  private readonly maxFileBytes = 25 * 1024 * 1024;
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  private async state(organizationId: string) {
    return this.prisma.workspaceState.upsert({
      where: { organizationId }, update: {}, create: { organizationId },
    });
  }

  private array(value: Prisma.JsonValue): JsonRecord[] { return Array.isArray(value) ? value as JsonRecord[] : []; }
  private dataUrl(value: string): { body: Buffer; contentType: string } {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(value);
    if (!match) throw new BadRequestException('El archivo no tiene un formato Base64 válido.');
    return { contentType: match[1].toLowerCase(), body: Buffer.from(match[2], 'base64') };
  }
  private assertCollection(collection: string): asserts collection is Exclude<WorkspaceCollection, 'companies' | 'employees'> {
    if (!['templates', 'generatedForms', 'stampPresets'].includes(collection)) {
      throw new BadRequestException('La colección solicitada no existe.');
    }
  }
  private assertFile(body: Buffer, contentType: string, allowed: string[]) {
    if (!body.length) throw new BadRequestException('El archivo está vacío.');
    if (body.length > this.maxFileBytes) throw new BadRequestException('El archivo supera el límite de 25 MB.');
    if (!allowed.includes(contentType)) throw new BadRequestException('El tipo de archivo no está permitido.');
    const valid = contentType === 'application/pdf'
      ? body.subarray(0, 5).toString() === '%PDF-'
      : contentType === 'image/png'
        ? body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
    if (!valid) throw new BadRequestException('El contenido del archivo no coincide con su formato.');
  }
  private async hydrateAsset(record: JsonRecord, property: string, keyProperty: string): Promise<JsonRecord> {
    const key = typeof record[keyProperty] === 'string' ? String(record[keyProperty]) : '';
    if (!key) return record;
    const asset = await this.storage.get(key);
    return { ...record, [property]: `data:${asset.contentType};base64,${asset.body.toString('base64')}` };
  }

  async bootstrap(organizationId: string) {
    const state = await this.state(organizationId);
    const templates = await Promise.all(this.array(state.templates).map(async (item) => {
      // Las plantillas incluidas en el frontend ya tienen un pdfAssetPath
      // versionado. No descargamos su copia de S3 en cada bootstrap: hacerlo
      // agregaba ~11 MB a toda respuesta y bloqueaba la interfaz durante varios
      // segundos. Los PDF personalizados continúan hidratándose normalmente.
      let hydrated = typeof item.pdfAssetPath === 'string' && item.pdfAssetPath
        ? item
        : await this.hydrateAsset(item, 'pdfBase64', '_pdfStorageKey');
      hydrated = await this.hydrateAsset(hydrated, 'thumbnailBase64', '_thumbnailStorageKey');
      return hydrated;
    }));
    const generatedForms = await Promise.all(this.array(state.generatedForms)
      .map((item) => this.hydrateAsset(item, 'pdfResultBase64', '_pdfStorageKey')));
    return { companies: this.array(state.companies), employees: this.array(state.employees), templates,
      generatedForms, stampPresets: this.array(state.stampPresets), activeCompanyId: state.activeCompanyId };
  }

  async replace(organizationId: string, collection: 'companies' | 'employees', items: unknown[]) {
    await this.state(organizationId);
    await this.prisma.workspaceState.update({ where: { organizationId }, data: { [collection]: items as Prisma.InputJsonValue } });
    return { success: true };
  }

  async setActiveCompany(organizationId: string, activeCompanyId: string | null) {
    await this.state(organizationId);
    await this.prisma.workspaceState.update({ where: { organizationId }, data: { activeCompanyId } });
    return { success: true };
  }

  async saveRecord(organizationId: string, collection: Exclude<WorkspaceCollection, 'companies' | 'employees'>, record: JsonRecord) {
    this.assertCollection(collection);
    const id = String(record.id || '');
    if (!id) throw new Error('El registro debe tener un identificador.');
    const state = await this.state(organizationId);
    const records = this.array(state[collection]);
    const existing = records.find((item) => String(item.id) === id);
    const stored: JsonRecord = { ...record };
    if (collection === 'templates') {
      await this.storeAsset(organizationId, stored, existing, 'pdfBase64', '_pdfStorageKey', `templates/${id}/base.pdf`, ['application/pdf']);
      await this.storeAsset(organizationId, stored, existing, 'thumbnailBase64', '_thumbnailStorageKey', `templates/${id}/thumbnail`, ['image/jpeg', 'image/png']);
    } else if (collection === 'generatedForms') {
      await this.storeAsset(organizationId, stored, existing, 'pdfResultBase64', '_pdfStorageKey', `generated/${id}.pdf`, ['application/pdf']);
    }
    const next = [stored, ...records.filter((item) => String(item.id) !== id)];
    await this.prisma.workspaceState.update({ where: { organizationId }, data: { [collection]: next as Prisma.InputJsonValue } });
    return { success: true };
  }

  private async storeAsset(organizationId: string, record: JsonRecord, existing: JsonRecord | undefined,
    property: string, keyProperty: string, suffix: string, allowedTypes: string[]) {
    const value = typeof record[property] === 'string' ? String(record[property]) : '';
    if (value.startsWith('data:')) {
      const asset = this.dataUrl(value);
      this.assertFile(asset.body, asset.contentType, allowedTypes);
      const key = `${organizationId}/${suffix}`;
      await this.storage.put(key, asset.body, asset.contentType);
      record[keyProperty] = key;
    } else if (existing?.[keyProperty]) record[keyProperty] = existing[keyProperty];
    delete record[property];
  }

  async removeRecord(organizationId: string, collection: Exclude<WorkspaceCollection, 'companies' | 'employees'>, id: string) {
    this.assertCollection(collection);
    const state = await this.state(organizationId);
    const records = this.array(state[collection]);
    const existing = records.find((item) => String(item.id) === id);
    // El cliente limpia identificadores históricos durante cada arranque. La
    // eliminación debe ser idempotente para que un tenant recién creado no
    // falle antes de importar sus plantillas predeterminadas.
    if (!existing) return { success: true };
    const keys = ['_pdfStorageKey', '_thumbnailStorageKey'].map((key) => existing[key]).filter((value): value is string => typeof value === 'string');
    await this.prisma.workspaceState.update({ where: { organizationId },
      data: { [collection]: records.filter((item) => String(item.id) !== id) as Prisma.InputJsonValue } });
    await Promise.all(keys.map((key) => this.storage.remove(key).catch(() => undefined)));
    return { success: true };
  }

  async listSupportDocuments(organizationId: string) {
    const rows = await this.prisma.soporteDocumento.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ id: row.id, nombre: row.nombre, categoria: row.categoria, tipo_archivo: row.tipoArchivo,
      tamano_bytes: Number(row.tamanoBytes), storage_path: row.storagePath, metadata: row.metadata || {},
      created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() }));
  }

  async createSupportDocument(organizationId: string, ownerId: string, input: JsonRecord) {
    const id = randomUUID();
    const name = String(input.nombre || 'soporte.pdf');
    const contentType = String(input.contentType || 'application/pdf').toLowerCase();
    const base64 = String(input.base64 || '');
    const body = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    this.assertFile(body, contentType, ['application/pdf', 'image/png', 'image/jpeg']);
    const extension = name.split('.').pop()?.toLowerCase() || 'pdf';
    const storagePath = `${organizationId}/support/${id}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await this.storage.put(storagePath, body, contentType);
    try {
      await this.prisma.soporteDocumento.create({ data: { id, organizationId, ownerId, nombre: name,
        categoria: String(input.categoria || 'Otro'), tipoArchivo: extension, tamanoBytes: BigInt(body.length),
        storagePath, metadata: (input.metadata || {}) as Prisma.InputJsonValue } });
    } catch (error) {
      await this.storage.remove(storagePath).catch(() => undefined);
      throw error;
    }
    return (await this.listSupportDocuments(organizationId)).find((item) => item.id === id);
  }

  async updateSupportDocument(organizationId: string, id: string, input: JsonRecord) {
    const existing = await this.prisma.soporteDocumento.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException();
    await this.prisma.soporteDocumento.update({ where: { id }, data: {
      ...(input.nombre !== undefined ? { nombre: String(input.nombre) } : {}),
      ...(input.categoria !== undefined ? { categoria: String(input.categoria) } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
    } });
    return { success: true };
  }

  async supportDocumentContent(organizationId: string, id: string) {
    const document = await this.prisma.soporteDocumento.findFirst({ where: { id, organizationId } });
    if (!document) throw new NotFoundException();
    const asset = await this.storage.get(document.storagePath);
    return { contentType: asset.contentType, base64: asset.body.toString('base64') };
  }

  async removeSupportDocument(organizationId: string, id: string) {
    const document = await this.prisma.soporteDocumento.findFirst({ where: { id, organizationId } });
    if (!document) throw new NotFoundException();
    await this.prisma.soporteDocumento.delete({ where: { id } });
    await this.storage.remove(document.storagePath).catch(() => undefined);
    return { success: true };
  }
}
