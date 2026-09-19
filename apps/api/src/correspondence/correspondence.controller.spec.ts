import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CorrespondenceApiKeyGuard } from './correspondence-api-key.guard';
import { CorrespondenceController } from './correspondence.controller';

describe('CorrespondenceController', () => {
  it('responde health sin consultar la base de correos', () => {
    const service = { ingest: jest.fn(), list: jest.fn(), detail: jest.fn(), update: jest.fn(), summary: jest.fn() };
    const sync = { reclassify: jest.fn(), runCycle: jest.fn() };
    const controller = new CorrespondenceController(service as never, sync as never);
    expect(controller.ingestHealth()).toEqual({ ok: true });
    expect(service.ingest).not.toHaveBeenCalled();
    expect(Reflect.getMetadata(GUARDS_METADATA, controller.ingestHealth)).toContain(CorrespondenceApiKeyGuard);
  });
});
