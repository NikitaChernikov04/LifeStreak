import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { assertProductionConfig } from './config/assert-production-config';

/**
 * The Vercel entry point. Nest is booted once per warm instance and the
 * resulting Express app is reused: building the module graph on every request
 * would put the whole DI container in the critical path of a check-in.
 *
 * The in-flight promise is cached rather than the app, so concurrent requests
 * arriving during a cold start wait on one boot instead of racing three.
 */
let booting: Promise<Express> | null = null;

async function bootstrap(): Promise<Express> {
  assertProductionConfig();

  const server = express();
  const app = configureApp(
    await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: ['error', 'warn', 'log'],
    }),
  );
  await app.init();

  return server;
}

export default async function handler(req: express.Request, res: express.Response) {
  if (!booting) {
    booting = bootstrap().catch((error) => {
      // A failed boot must not be cached, or the instance is poisoned until
      // Vercel happens to recycle it.
      booting = null;
      throw error;
    });
  }
  const server = await booting;
  server(req, res);
}
