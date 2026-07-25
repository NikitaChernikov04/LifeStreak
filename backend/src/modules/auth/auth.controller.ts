import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('telegram')
  loginWithTelegram(@Body() dto: TelegramAuthDto) {
    return this.authService.loginWithTelegram(dto.initData);
  }
}
