import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramService } from './telegram.service';

/** The shape of the two update kinds this bot cares about. */
interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string; type?: string };
    from?: { id?: number | string };
    text?: string;
  };
  my_chat_member?: {
    chat?: { id?: number | string; type?: string };
    new_chat_member?: { status?: string };
  };
}

const GREETING = [
  '<b>LifeStreak</b>',
  '',
  'Теперь я могу писать сюда. Только о том, что случилось без тебя: заявка в друзья, приглашение в общую цель, чужая реакция — и одно напоминание вечером, если день ещё не отмечен.',
  '',
  'Всё это выключается в приложении, на вкладке «Профиль».',
].join('\n');

/**
 * Where Telegram delivers updates.
 *
 * The endpoint is necessarily public, so the only thing standing between it
 * and the open internet is the secret token Telegram echoes back in a header.
 * Without one configured the webhook refuses everything: an unauthenticated
 * open endpoint that sends messages is worse than a broken one.
 */
@Public()
@SkipThrottle()
@Controller({ path: 'telegram', version: '1' })
export class TelegramWebhookController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    const expected = this.config.get<string>('telegram.webhookSecret');
    if (!expected || secret !== expected) throw new ForbiddenException();

    await this.handle(update);
    // Telegram retries anything that is not a prompt 200, so the answer is
    // always the same regardless of what we made of the update.
    return { ok: true };
  }

  private async handle(update: TelegramUpdate): Promise<void> {
    const membership = update.my_chat_member;
    if (membership?.chat?.type === 'private' && membership.chat.id !== undefined) {
      const status = membership.new_chat_member?.status;
      const chatId = String(membership.chat.id);
      if (status === 'kicked') {
        await this.telegram.markBlockedByChat(chatId);
      } else if (status === 'member') {
        await this.telegram.markReachable(chatId);
      }
      return;
    }

    const message = update.message;
    if (message?.chat?.type !== 'private' || message.chat.id === undefined) return;

    const chatId = String(message.chat.id);
    // Any message at all proves the chat is open — pressing Start is only the
    // most common way to prove it.
    await this.telegram.markReachable(chatId);

    if (message.text?.startsWith('/start')) {
      await this.telegram.sendMessage(chatId, GREETING, {
        button: { text: 'Открыть LifeStreak' },
      });
    }
  }
}
