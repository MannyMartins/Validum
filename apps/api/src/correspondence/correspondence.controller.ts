import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { SessionPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CorrespondenceApiKeyGuard } from './correspondence-api-key.guard';
import { CorrespondenceRateLimitGuard } from './correspondence-rate-limit.guard';
import {
  IngestCorrespondenceDto,
  IngestPayloadPipe,
  ListCorrespondenceDto,
  UpdateCorrespondenceDto,
} from './correspondence.dto';
import { CorrespondenceService } from './correspondence.service';
import { MailSyncService } from './mailbox/mail-sync.service';

@Controller('correspondencia')
export class CorrespondenceController {
  constructor(
    private readonly correspondence: CorrespondenceService,
    private readonly sync: MailSyncService,
  ) {}

  @Post('ingest')
  @HttpCode(200)
  @UseGuards(CorrespondenceApiKeyGuard, CorrespondenceRateLimitGuard)
  async ingest(
    @Body(IngestPayloadPipe) body: IngestCorrespondenceDto | IngestCorrespondenceDto[],
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.correspondence.ingest(body);
    response.status(result.created ? 201 : 200);
    return result.body;
  }

  @Get('ingest/health')
  @UseGuards(CorrespondenceApiKeyGuard)
  ingestHealth() {
    return { ok: true };
  }

  @Get('resumen')
  @UseGuards(JwtAuthGuard)
  summary() {
    return this.correspondence.summary();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query() query: ListCorrespondenceDto) {
    return this.correspondence.list(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  detail(@Param('id') id: string) {
    return this.correspondence.detail(id);
  }

  @Post(':id/reclasificar')
  @UseGuards(JwtAuthGuard)
  reclassify(@Req() req: { user: SessionPayload }, @Param('id') id: string) {
    if (!['owner', 'admin', 'operator'].includes(req.user.membershipRole)) {
      throw new ForbiddenException('Tu rol solo permite consultar la correspondencia.');
    }
    return this.sync.reclassify(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() req: { user: SessionPayload },
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) body: UpdateCorrespondenceDto,
  ) {
    if (!['owner', 'admin', 'operator'].includes(req.user.membershipRole)) {
      throw new ForbiddenException('Tu rol solo permite consultar la correspondencia.');
    }
    return this.correspondence.update(id, req.user.organizationId, body);
  }
}
