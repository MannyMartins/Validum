import { AppController } from './app.controller';

describe('AppController', () => {
  const controller = new AppController();

  it('reports a healthy API', () => {
    const response = controller.getHealth();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('api');
    expect(response.uptime).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });

  it('reports the API identity at its root', () => {
    expect(controller.getRoot()).toEqual({
      application: 'whatsapp-document-automation-api',
      status: 'running',
    });
  });
});
