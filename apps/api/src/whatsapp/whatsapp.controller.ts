import { Controller, Get, Post, Query, Body, ForbiddenException, HttpCode, Headers, Req } from '@nestjs/common';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsAppService } from './whatsapp.service';
@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(private whatsapp: WhatsAppService) {}
  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (verifyToken && mode === 'subscribe' && token === verifyToken) return challenge;
    throw new ForbiddenException('Webhook verification failed');
  }
  @Post()
  @HttpCode(200)
  async receive(@Body() body: Record<string, unknown>, @Headers('x-hub-signature-256') signature: string | undefined, @Req() request: Request & { rawBody?: Buffer }) {
    this.verifySignature(signature, request.rawBody);
    await this.whatsapp.receive(body);
    return { received: true };
  }

  private verifySignature(signature: string | undefined, rawBody: Buffer | undefined) {
    const secret = process.env.WHATSAPP_APP_SECRET;
    const maySkipLocally = process.env.NODE_ENV !== 'production' && process.env.WHATSAPP_SKIP_SIGNATURE_VERIFICATION === 'true';
    if (maySkipLocally) return;
    if (!secret || secret === 'provided-by-meta-app-dashboard') {
      throw new ForbiddenException('Webhook signature validation is not configured');
    }
    if (!signature || !rawBody) throw new ForbiddenException('Missing webhook signature');
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const received = Buffer.from(signature);
    const expectedValue = Buffer.from(expected);
    if (received.length !== expectedValue.length || !timingSafeEqual(received, expectedValue)) throw new ForbiddenException('Invalid webhook signature');
  }
}
