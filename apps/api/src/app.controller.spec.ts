import { AppController } from './app.controller';
import type { Response } from 'express';

describe('AppController', () => {
  const controller = new AppController();

  it('reports a healthy API', () => {
    const response = controller.getHealth();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('api');
    expect(response.uptime).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });

  it('redirects the service root to the configured application', () => {
    const previousAppUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://validum.example.com';
    const redirect = jest.fn();

    controller.getRoot({ redirect } as unknown as Response);

    expect(redirect).toHaveBeenCalledWith(302, 'https://validum.example.com');
    if (previousAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousAppUrl;
  });
});
