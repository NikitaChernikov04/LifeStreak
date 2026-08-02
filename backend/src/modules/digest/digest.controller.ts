import { Controller, ForbiddenException, Get, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { DigestService } from './digest.service';

/**
 * Called by the scheduler, not by the app. There is no in-process cron here on
 * purpose: the API runs as serverless functions that exist only while a
 * request is in flight, so a timer inside the process would fire on whichever
 * instance happened to be warm, or never.
 */
@Public()
@SkipThrottle()
@Controller({ path: 'cron', version: '1' })
export class DigestController {
  constructor(
    private readonly digest: DigestService,
    private readonly config: ConfigService,
  ) {}

  // Vercel's scheduler calls its cron paths with GET. The POST is for calling
  // it by hand, which is the only other thing that should ever call it — and
  // it needs its own handler: stacking both decorators on one method leaves
  // Nest registering whichever it read last.
  @Get('digest')
  async runScheduled(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-cron-secret') header: string | undefined,
  ) {
    return this.run(authorization, header);
  }

  @Post('digest')
  async run(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-cron-secret') header: string | undefined,
  ) {
    const expected = this.config.get<string>('cronSecret');
    // Vercel's scheduler sends the secret as a bearer token; the header form is
    // for calling it by hand. An unset secret means the endpoint stays shut
    // rather than open.
    const presented = authorization?.replace(/^Bearer\s+/i, '') ?? header;
    if (!expected || presented !== expected) throw new ForbiddenException();

    return this.digest.run();
  }
}
