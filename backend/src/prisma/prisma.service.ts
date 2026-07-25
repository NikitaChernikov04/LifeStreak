import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { resolveDatabaseUrl } from './resolve-database-url';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Local dev defaults to a file-backed SQLite DB so nobody needs a Turso
    // account just to run `npm run start:dev`. Production points DATABASE_URL
    // at libsql://<db>-<org>.turso.io with TURSO_AUTH_TOKEN set.
    const libsql = createClient({
      url: resolveDatabaseUrl(process.env.DATABASE_URL ?? 'file:./dev.db'),
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);

    super({
      adapter,
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to Turso/libSQL via Prisma');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
