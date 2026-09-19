import * as express from 'express';
import * as request from 'supertest';
import { correspondenceBodyLimitMiddleware } from './correspondence-body-limit.middleware';

describe('límite del body de ingesta', () => {
  const app = express();
  app.use('/api/correspondencia/ingest', correspondenceBodyLimitMiddleware());
  app.use(express.json({ limit: '4mb' }));
  app.post('/api/correspondencia/ingest', (_request, response) => response.json({ ok: true }));
  app.post('/otra-ruta', (_request, response) => response.json({ ok: true }));

  it('rechaza un body mayor a 2 MB sin afectar otras rutas', async () => {
    await request(app).post('/api/correspondencia/ingest').send({ textPlain: 'x'.repeat(2 * 1024 * 1024) }).expect(413);
    await request(app).post('/otra-ruta').send({ textPlain: 'x'.repeat(2 * 1024 * 1024) }).expect(200);
  });

  it('rechaza JSON ilegible', async () => {
    await request(app)
      .post('/api/correspondencia/ingest')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
  });
});
