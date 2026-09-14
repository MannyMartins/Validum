import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  getRoot() {
    return {
      application: 'whatsapp-document-automation-api',
      status: 'running',
    };
  }
}
