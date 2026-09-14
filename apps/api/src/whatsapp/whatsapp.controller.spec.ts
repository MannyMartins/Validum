import { createHmac } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppController', () => {
  const receive = jest.fn().mockResolvedValue(undefined);
  const controller = new WhatsAppController({ receive } as unknown as WhatsAppService);
  const previousSecret = process.env.WHATSAPP_APP_SECRET;
  const previousSkip = process.env.WHATSAPP_SKIP_SIGNATURE_VERIFICATION;
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    receive.mockClear();
    if (previousSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = previousSecret;
    if (previousSkip === undefined) delete process.env.WHATSAPP_SKIP_SIGNATURE_VERIFICATION;
    else process.env.WHATSAPP_SKIP_SIGNATURE_VERIFICATION = previousSkip;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  it('rejects unsigned webhooks when signature validation is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WHATSAPP_APP_SECRET;
    const rawBody = Buffer.from('{}');

    await expect(controller.receive({}, undefined, { rawBody } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(receive).not.toHaveBeenCalled();
  });

  it('accepts a webhook carrying a valid Meta signature', async () => {
    process.env.NODE_ENV = 'production';
    process.env.WHATSAPP_APP_SECRET = 'a-secure-meta-app-secret';
    const rawBody = Buffer.from('{"entry":[]}');
    const signature = `sha256=${createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex')}`;

    await expect(controller.receive({ entry: [] }, signature, { rawBody } as never)).resolves.toEqual({ received: true });
    expect(receive).toHaveBeenCalledWith({ entry: [] });
  });
});
