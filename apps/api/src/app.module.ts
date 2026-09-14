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
import { WorkspaceModule } from './workspace/workspace.module';
import { TeamModule } from './team/team.module';

import { AppController } from './app.controller';

export function validateEnvironment(config: Record<string, unknown>) {
  const required = ['DATABASE_URL', 'REDIS_URL'];
  for (const name of required) {
    if (!String(config[name] || '').trim()) {
      throw new Error(`${name} es obligatorio.`);
    }
  }

  const jwtSecret = String(config.JWT_SECRET || '');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET es obligatorio y debe contener al menos 32 caracteres.');
  }

  const tokenLifetime = Number(config.JWT_EXPIRES_IN_SECONDS || 28_800);
  if (!Number.isInteger(tokenLifetime) || tokenLifetime <= 0) {
    throw new Error('JWT_EXPIRES_IN_SECONDS debe ser un entero positivo.');
  }

  if (String(config.NODE_ENV || '').toLowerCase() === 'production') {
    const productionRequired = [
      'DASHBOARD_ORIGIN',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_APP_SECRET',
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'APP_URL',
    ];
    for (const name of productionRequired) {
      const value = String(config[name] || '').trim();
      if (!value || value.startsWith('provided-by-') || value.startsWith('replace-with-')) {
        throw new Error(`${name} debe configurarse con un valor real en produccion.`);
      }
    }

    const origins = String(config.DASHBOARD_ORIGIN)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (!origins.length || origins.some((origin) => origin === '*' || !origin.startsWith('https://'))) {
      throw new Error('DASHBOARD_ORIGIN debe contener uno o mas origenes HTTPS separados por coma.');
    }
  }
  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    BullModule.forRootAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({ connection: { url: c.getOrThrow('REDIS_URL') } }) }),
    PrismaModule, AuthModule, AuditModule, DocumentsModule, WhatsAppModule, CasesModule, ApplicationsModule, AffiliatesModule, WorkspaceModule, TeamModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
