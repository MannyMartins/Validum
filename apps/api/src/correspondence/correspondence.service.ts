import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CorrespondenceCategory,
  CorrespondencePriority,
  CorrespondenceStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.module';
import {
  CATEGORY_LABELS,
  IngestCorrespondenceDto,
  ListCorrespondenceDto,
  PRIORITY_LABELS,
  UpdateCorrespondenceDto,
} from './correspondence.dto';

const categories: Record<string, CorrespondenceCategory> = {
  'Términos jurídicos': CorrespondenceCategory.TERMINOS_JURIDICOS,
  'Cobros Jurídicos': CorrespondenceCategory.COBROS_JURIDICOS,
  'Consulta General': CorrespondenceCategory.CONSULTA_GENERAL,
  'Soporte Operativo': CorrespondenceCategory.SOPORTE_OPERATIVO,
};
const priorities: Record<string, CorrespondencePriority> = {
  Urgente: CorrespondencePriority.URGENTE,
  Moderado: CorrespondencePriority.MODERADO,
  'Respuesta Ligera': CorrespondencePriority.RESPUESTA_LIGERA,
};
const statuses: Record<string, CorrespondenceStatus> = {
  pendiente: CorrespondenceStatus.PENDIENTE,
  en_revision: CorrespondenceStatus.EN_REVISION,
  respondido: CorrespondenceStatus.RESPONDIDO,
  archivado: CorrespondenceStatus.ARCHIVADO,
};
const categoryLabels: Record<CorrespondenceCategory, string> = Object.fromEntries(
  Object.entries(categories).map(([label, value]) => [value, label]),
) as Record<CorrespondenceCategory, string>;
const priorityLabels: Record<CorrespondencePriority, string> = Object.fromEntries(
  Object.entries(priorities).map(([label, value]) => [value, label]),
) as Record<CorrespondencePriority, string>;
const statusLabels: Record<CorrespondenceStatus, string> = Object.fromEntries(
  Object.entries(statuses).map(([label, value]) => [value, label]),
) as Record<CorrespondenceStatus, string>;

@Injectable()
export class CorrespondenceService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(payload: IngestCorrespondenceDto | IngestCorrespondenceDto[]) {
    const isBatch = Array.isArray(payload);
    const rows = isBatch ? payload : [payload];
    const results = await Promise.all(rows.map(row => this.ingestOperation(row)));
    return { body: isBatch ? { resultados: results } : results[0], created: results.some(result => result.creado) };
  }

  private ingestOperation(row: IngestCorrespondenceDto) {
    const validClassification = CATEGORY_LABELS.includes(row.categoria as never)
      && PRIORITY_LABELS.includes(row.prioridad as never);
    const categoria = validClassification ? categories[row.categoria] : CorrespondenceCategory.CONSULTA_GENERAL;
    const prioridad = validClassification ? priorities[row.prioridad] : CorrespondencePriority.MODERADO;
    const rawClassification = validClassification
      ? row.respuesta_cruda || null
      : JSON.stringify({
          respuesta_cruda: row.respuesta_cruda || null,
          categoria_original: row.categoria,
          prioridad_original: row.prioridad,
        });
    const where = {
      cuentaDestino_gmailMessageId: {
        cuentaDestino: row.to.trim(),
        gmailMessageId: row.messageId.trim(),
      },
    };
    const data = {
      gmailThreadId: row.threadId.trim(),
      remitenteCorreo: row.from.trim(),
      asunto: row.subject,
      cuerpo: row.textPlain,
      fechaRecepcion: new Date(row.fecha),
      remitenteNombre: row.remitente_nombre.trim(),
      identificacion: row.identificacion?.trim() || null,
      empresaRelacionada: row.empresa_relacionada?.trim() || null,
      categoria,
      prioridad,
      resumen: row.resumen,
      documentosRequeridos: row.documentos_requeridos,
      propuestaRespuesta: row.propuesta_respuesta,
      alertaInmediata: row.alerta_inmediata,
      errorClasificacion: Boolean(row.error_parseo) || !validClassification,
      respuestaCrudaIa: rawClassification,
    } satisfies Prisma.CorreoClasificadoUpdateInput;

    return this.prisma.correoClasificado.findUnique({ where, select: { id: true } }).then(existing =>
      this.prisma.correoClasificado.upsert({
        where,
        update: data,
        create: {
          ...data,
          cuentaDestino: row.to.trim(),
          gmailMessageId: row.messageId.trim(),
        },
        select: { id: true },
      }).then(saved => ({ id: saved.id, creado: !existing, resultado: existing ? 'actualizado' : 'creado' })),
    );
  }

  async list(query: ListCorrespondenceDto) {
    const where = this.buildWhere(query);
    const page = query.pagina || 1;
    const limit = query.limite || 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.correoClasificado.findMany({
        where,
        select: {
          id: true,
          cuentaDestino: true,
          remitenteCorreo: true,
          remitenteNombre: true,
          asunto: true,
          fechaRecepcion: true,
          identificacion: true,
          empresaRelacionada: true,
          categoria: true,
          prioridad: true,
          resumen: true,
          alertaInmediata: true,
          estado: true,
          errorClasificacion: true,
          asignadoA: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ alertaInmediata: 'desc' }, { prioridad: 'asc' }, { fechaRecepcion: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.correoClasificado.count({ where }),
    ]);
    return {
      items: items.map(item => this.serialize(item)),
      paginacion: { pagina: page, limite: limit, total, paginas: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async detail(id: string) {
    const item = await this.prisma.correoClasificado.findUnique({
      where: { id },
      include: { asignadoA: { select: { id: true, fullName: true, email: true } } },
    });
    if (!item) throw new NotFoundException('Correo no encontrado.');
    return this.serialize(item);
  }

  async update(id: string, organizationId: string, dto: UpdateCorrespondenceDto) {
    await this.detail(id);
    if (dto.asignado_a) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: dto.asignado_a } },
      });
      if (!membership?.active) throw new BadRequestException('El usuario asignado no pertenece a la organización activa.');
    }
    const item = await this.prisma.correoClasificado.update({
      where: { id },
      data: {
        estado: dto.estado ? statuses[dto.estado] : undefined,
        asignadoAId: dto.asignado_a === undefined ? undefined : dto.asignado_a || null,
        notasInternas: dto.notas_internas === undefined ? undefined : dto.notas_internas || null,
        propuestaRespuesta: dto.propuesta_respuesta,
      },
      include: { asignadoA: { select: { id: true, fullName: true, email: true } } },
    });
    return this.serialize(item);
  }

  async summary() {
    const [byCategory, byPriority, byStatus, pendingAlerts, total] = await this.prisma.$transaction([
      this.prisma.correoClasificado.groupBy({ by: ['categoria'], _count: true, orderBy: { categoria: 'asc' } }),
      this.prisma.correoClasificado.groupBy({ by: ['prioridad'], _count: true, orderBy: { prioridad: 'asc' } }),
      this.prisma.correoClasificado.groupBy({ by: ['estado'], _count: true, orderBy: { estado: 'asc' } }),
      this.prisma.correoClasificado.count({ where: { alertaInmediata: true, estado: CorrespondenceStatus.PENDIENTE } }),
      this.prisma.correoClasificado.count(),
    ]);
    return {
      total,
      alertas_pendientes: pendingAlerts,
      por_categoria: Object.fromEntries(byCategory.map(row => [categoryLabels[row.categoria], row._count])),
      por_prioridad: Object.fromEntries(byPriority.map(row => [priorityLabels[row.prioridad], row._count])),
      por_estado: Object.fromEntries(byStatus.map(row => [statusLabels[row.estado], row._count])),
    };
  }

  private buildWhere(query: ListCorrespondenceDto): Prisma.CorreoClasificadoWhereInput {
    const search = query.busqueda?.trim();
    const fechaHasta = query.fecha_hasta ? new Date(query.fecha_hasta) : undefined;
    if (fechaHasta && /^\d{4}-\d{2}-\d{2}$/.test(query.fecha_hasta || '')) fechaHasta.setUTCHours(23, 59, 59, 999);
    return {
      categoria: query.categoria ? categories[query.categoria] : undefined,
      prioridad: query.prioridad ? priorities[query.prioridad] : undefined,
      estado: query.estado ? statuses[query.estado] : undefined,
      cuentaDestino: query.cuenta_destino?.trim() || undefined,
      alertaInmediata: query.alerta_inmediata,
      fechaRecepcion: query.fecha_desde || fechaHasta ? {
        gte: query.fecha_desde ? new Date(query.fecha_desde) : undefined,
        lte: fechaHasta,
      } : undefined,
      OR: search ? [
        { asunto: { contains: search, mode: 'insensitive' } },
        { remitenteCorreo: { contains: search, mode: 'insensitive' } },
        { remitenteNombre: { contains: search, mode: 'insensitive' } },
        { identificacion: { contains: search, mode: 'insensitive' } },
        { empresaRelacionada: { contains: search, mode: 'insensitive' } },
      ] : undefined,
    };
  }

  private serialize<T extends Record<string, any>>(item: T) {
    return {
      ...item,
      categoria: item.categoria ? categoryLabels[item.categoria as CorrespondenceCategory] : item.categoria,
      prioridad: item.prioridad ? priorityLabels[item.prioridad as CorrespondencePriority] : item.prioridad,
      estado: item.estado ? statusLabels[item.estado as CorrespondenceStatus] : item.estado,
      asignado_a: item.asignadoA || null,
      asignadoA: undefined,
    };
  }
}
