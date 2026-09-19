import { MailSyncProcessor } from './mail-sync.processor';

describe('interruptor de lectura', () => {
  it.each([undefined, 'false', 'TRUE', '1'])('no procesa trabajos antiguos con configuración %s', async value => {
    const sync = { runCycle: jest.fn() };
    const processor = new MailSyncProcessor({ get: () => value } as never, sync as never, {} as never);
    await processor.process();
    expect(sync.runCycle).not.toHaveBeenCalled();
  });
});
