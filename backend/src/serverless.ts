import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { assertProductionConfig } from './config/assert-production-config';

/**
 * Serverless entry point (Vercel Functions).
 *
 * Differs from main.ts in three ways that matter in a serverless runtime:
 *  - nothing listens on a port; the platform owns the socket
 *  - the Express instance is cached across invocations, so a warm container
 *    reuses the built Nest app instead of re-bootstrapping per request
 *  - LoggingInterceptor is left out — the platform already logs every request,
 *    and duplicating it doubles the log bill for no new information
 *
 * Kept deliberately in sync with main.ts for pipes, filters and versioning:
 * a route that behaves differently here than in local dev is a trap.
 */
let cached: Express | undefined;

async function bootstrap(): Promise<Express> {
  assertProductionConfig();

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn'],
  });

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  return expressApp;
}

export default async function handler(req: express.Request, res: express.Response) {
  if (!cached) {
    cached = await bootstrap();
  }
  return cached(req, res);
}
