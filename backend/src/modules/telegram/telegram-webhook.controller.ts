import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramService } from './telegram.service';
import { ChatCircleService } from './chat-circle.service';

/** The shape of the two update kinds this bot cares about. */
interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string; type?: string; title?: string };
    from?: { id?: number | string };
    text?: string;
  };
  my_chat_member?: {
    chat?: { id?: number | string; type?: string; title?: string };
    old_chat_member?: { status?: string };
    new_chat_member?: { status?: string };
  };
}

/** Commands the bot answers inside a group chat. */
type GroupCommand = 'join' | 'leave' | 'status' | 'help';
const GROUP_COMMANDS: readonly GroupCommand[] = ['join', 'leave', 'status', 'help'];

const GROUP_TYPES = new Set(['group', 'supergroup']);
/** Being in the chat at all — administrator is just a member with extra rights. */
const PRESENT = new Set(['member', 'administrator', 'creator']);

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
    private readonly circles: ChatCircleService,
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
    if (membership?.chat?.id !== undefined) {
      await this.membershipChanged(membership);
      return;
    }

    const message = update.message;
    if (message?.chat?.id === undefined) return;

    const chatId = String(message.chat.id);

    if (GROUP_TYPES.has(message.chat.type ?? '')) {
      const command = this.groupCommand(message.text);
      // Privacy mode leaves us only commands addressed to the bot, which is
      // exactly the amount of the conversation we want to see.
      if (!command || message.from?.id === undefined) return;
      await this.circles.command(chatId, String(message.from.id), command, message.chat.title);
      return;
    }

    if (message.chat.type !== 'private') return;

    // Any message at all proves the chat is open — pressing Start is only the
    // most common way to prove it.
    await this.telegram.markReachable(chatId);

    if (message.text?.startsWith('/start')) {
      await this.telegram.sendMessage(chatId, GREETING, {
        button: { text: 'Открыть LifeStreak' },
      });
    }
  }

  private async membershipChanged(
    membership: NonNullable<TelegramUpdate['my_chat_member']>,
  ): Promise<void> {
    const chatId = String(membership.chat!.id);
    const type = membership.chat?.type ?? '';
    const was = membership.old_chat_member?.status ?? '';
    const now = membership.new_chat_member?.status ?? '';

    if (GROUP_TYPES.has(type)) {
      if (PRESENT.has(now)) {
        // Only on the way in. Being promoted to admin is also a change of
        // status, and it should not read as an introduction all over again.
        if (!PRESENT.has(was)) await this.circles.register(chatId, membership.chat?.title);
      } else {
        await this.circles.deactivate(chatId);
      }
      return;
    }

    if (type !== 'private') return;
    if (now === 'kicked') {
      await this.telegram.markBlockedByChat(chatId);
    } else if (now === 'member') {
      await this.telegram.markReachable(chatId);
    }
  }

  /**
   * `/join`, `/join@TheBot`, `/join something` — all the same instruction.
   * Anything else in a group is not addressed to us.
   */
  private groupCommand(text: string | undefined): GroupCommand | null {
    if (!text?.startsWith('/')) return null;
    const word = text.slice(1).split(/[\s@]/, 1)[0]?.toLowerCase() ?? '';
    return (GROUP_COMMANDS as readonly string[]).includes(word) ? (word as GroupCommand) : null;
  }
}
