import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { assertProductionConfig } from './config/assert-production-config';

async function bootstrap() {
  // Before anything binds a port: a misconfigured production instance must
  // fail to start rather than serve forged logins.
  assertProductionConfig();

  const app = configureApp(
    await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] }),
  );

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🔥 LifeStreak API running on http://localhost:${port}/api/v1`);
}

bootstrap();
