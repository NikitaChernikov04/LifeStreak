import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { DemoAuthDto } from './dto/demo-auth.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('telegram')
  loginWithTelegram(@Body() dto: TelegramAuthDto) {
    return this.authService.loginWithTelegram(dto.initData);
  }

  /**
   * The demo entrance — see AuthService.loginAsDemo for why it is safe to have
   * a door that Telegram does not guard.
   *
   * Throttled far below the app's normal allowance: nobody needs to sign into
   * a demo five times a minute, and a key is the kind of thing people try to
   * guess in bulk.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('demo')
  loginAsDemo(@Body() dto: DemoAuthDto) {
    return this.authService.loginAsDemo(dto.secret);
  }
}
