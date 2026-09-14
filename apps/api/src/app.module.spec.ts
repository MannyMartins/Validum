import { validateEnvironment } from './app.module';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://user:password@database:5432/validum',
  REDIS_URL: 'redis://redis:6379',
  JWT_SECRET: 'x'.repeat(32),
};

const productionServices = {
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'private-documents',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
  WHATSAPP_ACCESS_TOKEN: 'access-token',
  WHATSAPP_PHONE_NUMBER_ID: '123456',
  WHATSAPP_APP_SECRET: 'meta-secret',
  RESEND_API_KEY: 'resend-key',
  EMAIL_FROM: 'Validum <no-reply@example.com>',
  APP_URL: 'https://dashboard.example.com',
};

describe('validateEnvironment', () => {
  it('rejects a missing database connection', () => {
    expect(() => validateEnvironment({ ...baseEnvironment, DATABASE_URL: '' })).toThrow('DATABASE_URL es obligatorio');
  });

  it('rejects a missing Redis connection', () => {
    expect(() => validateEnvironment({ ...baseEnvironment, REDIS_URL: '' })).toThrow('REDIS_URL es obligatorio');
  });

  it('rejects a weak JWT secret', () => {
    expect(() => validateEnvironment({ ...baseEnvironment, JWT_SECRET: 'public-secret' })).toThrow(
      'JWT_SECRET es obligatorio y debe contener al menos 32 caracteres',
    );
  });

  it('rejects an insecure production origin', () => {
    expect(() => validateEnvironment({
      ...baseEnvironment,
      ...productionServices,
      NODE_ENV: 'production',
      DASHBOARD_ORIGIN: '*',
    })).toThrow('DASHBOARD_ORIGIN debe contener');
  });

  it('accepts a complete production configuration', () => {
    const environment = {
      ...baseEnvironment,
      ...productionServices,
      NODE_ENV: 'production',
      DASHBOARD_ORIGIN: 'https://dashboard.example.com',
    };

    expect(validateEnvironment(environment)).toBe(environment);
  });
});
