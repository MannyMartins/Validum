import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { MailSyncService } from './mail-sync.service';

export const MAIL_SYNC_QUEUE = 'correspondence-sync';
const REPEATABLE_JOB_ID = 'ciclo-correspondencia';
const DEFAULT_CRON = '*/5 * * * *';

/**
 * El ciclo se programa como trabajo repetible de BullMQ. Eso nos da, sin
 * código adicional, que solo una réplica ejecute cada ciclo aunque el servicio
 * escale horizontalmente.
 */
@Injectable()
@Processor(MAIL_SYNC_QUEUE)
export class MailSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MailSyncProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sync: MailSyncService,
    @InjectQueue(MAIL_SYNC_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  private get cron(): string {
    return String(this.config.get('CORRESPONDENCIA_POLL_CRON') || '').trim() || DEFAULT_CRON;
  }

  private get enabled(): boolean {
    return this.config.get('CORRESPONDENCIA_POLL_ENABLED') === 'true';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Sincronización de correspondencia desactivada por configuración.');
      return;
    }
    try {
      // Se eliminan programaciones previas para que un cambio de cron no deje dos activas.
      const existing = await this.queue.getRepeatableJobs();
      await Promise.all(
        existing
          .filter(job => job.id === REPEATABLE_JOB_ID || job.name === REPEATABLE_JOB_ID)
          .map(job => this.queue.removeRepeatableByKey(job.key)),
      );
      await this.queue.add(
        REPEATABLE_JOB_ID,
        {},
        {
          jobId: REPEATABLE_JOB_ID,
          repeat: { pattern: this.cron },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      this.logger.log(`Sincronización de correspondencia programada con el patrón "${this.cron}".`);
    } catch (error) {
      this.logger.error(`No se pudo programar la sincronización: ${(error as Error).message}`);
    }
  }

  async process() {
    // Repeat jobs already in Redis must also respect the off switch.
    if (!this.enabled) return { cuentas: 0, nuevos: 0, conError: 0 };
    const results = await this.sync.runCycle();
    const nuevos = results.reduce((total, row) => total + row.nuevos, 0);
    const conError = results.filter(row => row.error).length;
    if (nuevos || conError) {
      this.logger.log(`Ciclo terminado: ${nuevos} correo(s) nuevo(s), ${conError} cuenta(s) con error.`);
    }
    return { cuentas: results.length, nuevos, conError };
  }
}
