import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

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
  getRoot(@Res() response: Response) {
    return response.redirect(302, process.env.APP_URL || 'http://localhost:3000');
  }
}
