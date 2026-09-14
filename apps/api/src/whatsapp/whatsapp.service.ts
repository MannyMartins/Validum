import { Injectable, Logger } from '@nestjs/common';
import { CaseStatus, Channel, ConversationState, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.module';
import { AuditService } from '../audit/audit.service';

const SUPPORTED_EPS = ['SANITAS', 'NUEVA EPS', 'SALUD TOTAL', 'FAMISANAR', 'COMPENSAR', 'COOSALUD', 'SURA', 'CAPITAL SALUD', 'ALIANSALUD'];

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async receive(payload: Record<string, unknown>) {
    const value = (payload.entry as Array<{ changes?: Array<{ value?: Record<string, any> }> }> | undefined)?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message?.id || !message?.from) return;
    const contact = await this.prisma.contact.upsert({ where: { whatsappId: message.from }, update: { displayName: value?.contacts?.[0]?.profile?.name }, create: { whatsappId: message.from, displayName: value?.contacts?.[0]?.profile?.name } });
    if (await this.prisma.whatsAppMessage.findUnique({ where: { metaMessageId: message.id } })) return;
    const text = (message.text?.body || '').trim();
    await this.prisma.whatsAppMessage.create({ data: { contactId: contact.id, metaMessageId: message.id, direction: 'INBOUND', messageType: message.type || 'unknown', content: text || null } });
    const session = await this.prisma.conversationSession.upsert({ where: { contactId: contact.id }, update: {}, create: { contactId: contact.id, state: ConversationState.NEW, context: {} } });
    await this.audit.log({ action: 'whatsapp.message.received', entityType: 'Contact', entityId: contact.id, channel: Channel.WHATSAPP, metadata: { messageId: message.id, type: message.type } });
    if (message.type !== 'text') return this.reply(contact.whatsappId, 'Recibimos tu archivo. Continúa respondiendo las preguntas; nuestro equipo revisará los soportes antes de radicar.');
    return this.advance(contact.whatsappId, session.id, session.state, session.caseId, session.context as Record<string, string> | null, text);
  }

  private async advance(phone: string, sessionId: string, state: ConversationState, caseId: string | null, context: Record<string, string> | null, text: string) {
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const data = context || {};
    if (state === ConversationState.NEW) {
      await this.updateSession(sessionId, ConversationState.AWAITING_APPLICATION_TYPE, data);
      return this.reply(phone, 'Hola. Soy el asistente de Formularios EPS. Responde 1 para afiliación o 2 para reporte de novedad.');
    }
    if (state === ConversationState.AWAITING_APPLICATION_TYPE) {
      const type = normalized === '1' || normalized.includes('AFILIACION') ? 'AFILIACION' : normalized === '2' || normalized.includes('NOVEDAD') ? 'NOVEDAD' : null;
      if (!type) return this.reply(phone, 'No entendí la opción. Responde 1 para afiliación o 2 para reporte de novedad.');
      const created = await this.prisma.case.create({ data: { reference: `WA-${Date.now()}`, status: CaseStatus.RECEIVED, contact: { connect: { whatsappId: phone } }, extractedData: { applicationType: type } } });
      await this.updateSession(sessionId, ConversationState.AWAITING_DOCUMENT, { ...data, applicationType: type }, created.id);
      return this.reply(phone, 'Indícame el número de documento del cotizante, sin puntos ni espacios.');
    }
    if (state === ConversationState.AWAITING_DOCUMENT) {
      if (!/^[A-Z0-9-]{5,20}$/.test(normalized)) return this.reply(phone, 'Verifica el documento e inténtalo de nuevo, sin puntos ni espacios.');
      await this.updateSession(sessionId, ConversationState.AWAITING_FULL_NAME, { ...data, documentNumber: normalized }, caseId);
      return this.reply(phone, 'Escribe los nombres y apellidos completos del cotizante.');
    }
    if (state === ConversationState.AWAITING_FULL_NAME) {
      if (text.length < 5) return this.reply(phone, 'Necesito el nombre completo del cotizante para continuar.');
      await this.updateSession(sessionId, ConversationState.AWAITING_EPS, { ...data, fullName: text }, caseId);
      return this.reply(phone, `¿Para cuál EPS es el trámite? Opciones iniciales: ${SUPPORTED_EPS.join(', ')}.`);
    }
    if (state === ConversationState.AWAITING_EPS) {
      const eps = SUPPORTED_EPS.find((name) => normalized === name || normalized.includes(name));
      if (!eps) return this.reply(phone, `Por ahora atendemos: ${SUPPORTED_EPS.join(', ')}. Escribe una de esas opciones.`);
      if (caseId) await this.prisma.case.update({ where: { id: caseId }, data: { epsName: eps, status: CaseStatus.REVIEW_REQUIRED, extractedData: { ...data, epsName: eps } } });
      await this.updateSession(sessionId, ConversationState.COMPLETED, { ...data, epsName: eps }, caseId);
      return this.reply(phone, 'Solicitud recibida. Nuestro equipo validará los datos y soportes antes de preparar el formulario para radicación.');
    }
    if (normalized === 'NUEVA' || normalized === 'NUEVO') {
      await this.updateSession(sessionId, ConversationState.AWAITING_APPLICATION_TYPE, {});
      return this.reply(phone, 'Responde 1 para afiliación o 2 para reporte de novedad.');
    }
    return this.reply(phone, 'Tu solicitud está en revisión. Responde NUEVA si deseas iniciar otro trámite.');
  }

  private updateSession(id: string, state: ConversationState, context: Record<string, string>, caseId?: string | null) {
    return this.prisma.conversationSession.update({ where: { id }, data: { state, context: context as Prisma.InputJsonValue, ...(caseId ? { caseId } : {}) } });
  }

  private async reply(to: string, body: string) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId || token === 'provided-by-meta-system-user-token') {
      this.logger.log(`[WhatsApp local] To ${to}: ${body}`);
      return;
    }
    const version = process.env.WHATSAPP_API_VERSION || 'v22.0';
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }) });
    if (!response.ok) this.logger.error(`WhatsApp send failed: ${await response.text()}`);
  }
}
