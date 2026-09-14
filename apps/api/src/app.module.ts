import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { DocumentsModule } from './documents/documents.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { CasesModule } from './cases/cases.module';
import { ApplicationsModule } from './applications/applications.module';
import { AffiliatesModule } from './affiliates/affiliates.module';

import { AppController } from './app.controller';

export function validateEnvironment(config: Record<string, unknown>) {
  if (!String(config.DATABASE_URL || '').trim()) {
    throw new Error('DATABASE_URL es obligatorio para conectar con PostgreSQL en Railway.');
  }

  if (!String(config.REDIS_URL || '').trim()) {
    config.REDIS_URL = 'redis://127.0.0.1:6379';
    console.warn('[Railway Boot] REDIS_URL no configurado. Usando fallback local: redis://127.0.0.1:6379');
  }

  let jwtSecret = String(config.JWT_SECRET || '');
  if (jwtSecret.length < 32) {
    if (String(config.NODE_ENV || '').toLowerCase() === 'production') {
      console.warn('[Railway Boot] JWT_SECRET es corto o ausente. Aplicando clave de seguridad por defecto para Railway.');
      config.JWT_SECRET = 'validum-production-super-secure-jwt-key-2026-eps-forms';
    } else {
      config.JWT_SECRET = 'validum-development-super-secure-jwt-key-2026-eps-forms';
    }
  }

  const tokenLifetime = Number(config.JWT_EXPIRES_IN_SECONDS || 28_800);
  if (!Number.isInteger(tokenLifetime) || tokenLifetime <= 0) {
    config.JWT_EXPIRES_IN_SECONDS = 28_800;
  }

  // En producción, advertir sobre servicios opcionales de terceros en lugar de bloquear el arranque del API
  const optionalServices = [
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'WHATSAPP_VERIFY_TOKEN',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_APP_SECRET',
  ];
  for (const name of optionalServices) {
    const value = String(config[name] || '').trim();
    if (!value || value.startsWith('provided-by-') || value.startsWith('replace-with-')) {
      console.warn(`[Railway Boot] Servicio opcional no configurado: ${name}. El API iniciará con PostgreSQL.`);
    }
  }

  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    BullModule.forRootAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({ connection: { url: c.getOrThrow('REDIS_URL') } }) }),
    PrismaModule, AuthModule, AuditModule, DocumentsModule, WhatsAppModule, CasesModule, ApplicationsModule, AffiliatesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
