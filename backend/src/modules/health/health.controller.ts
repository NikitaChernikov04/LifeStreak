import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Liveness/readiness probe for the platform (Docker health checks, uptime
 * pings). Touches the database on purpose, and deliberately does not catch:
 * an instance that cannot reach Postgres must fail the check rather than
 * answer "ok" and then serve 500s to real users.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    // How long the round trip to Postgres took, reported rather than
    // discarded. Every interesting endpoint here is a chain of sequential
    // queries, so this number multiplied by the length of that chain is what
    // a user actually waits for — and it is the number that says whether the
    // function and the database still live in the same region.
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - started;

    return { status: 'ok', uptime: Math.round(process.uptime()), dbMs };
  }
}
