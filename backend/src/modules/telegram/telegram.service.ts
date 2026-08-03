import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * What happened to one outgoing message.
 *
 * BLOCKED is the interesting one: Telegram answers 403 both when the user has
 * blocked the bot and when they have never pressed Start at all. Opening a
 * Mini App from a link does not count as starting the bot, so a brand new user
 * is indistinguishable from one who walked away — in both cases the only cure
 * is the same, and it is the user's to apply.
 */
export type SendResult = 'SENT' | 'BLOCKED' | 'SKIPPED' | 'FAILED';

export interface SendOptions {
  /** Inline button opening the Mini App. Omitted when there is nothing to open. */
  button?: { text: string; startParam?: string };
}

/** Serverless has no patience: a hung request would hold the whole invocation. */
const REQUEST_TIMEOUT_MS = 6_000;

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  /** Resolved once per process — the bot's @username never changes at runtime. */
  private botUsername: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('telegram.botToken'));
  }

  /**
   * Sends one message and reports what became of it. Never throws: this is
   * called from inside request handlers that have already done the real work,
   * and a message that failed to leave must not undo a check-in.
   */
  async sendMessage(telegramId: string, text: string, options: SendOptions = {}): Promise<SendResult> {
    const result = await this.sendToChat(telegramId, text, options);
    if (result === 'BLOCKED') await this.markBlocked(telegramId);
    return result;
  }

  /**
   * The same send without the conclusion about a person. A group chat can
   * refuse us too — the bot was removed, the group was upgraded to a
   * supergroup and changed id — but that says nothing about anybody's private
   * chat, and writing it to a user row would silence someone who never did
   * anything. Callers that own a chat deal with BLOCKED themselves.
   */
  async sendToChat(chatId: string, text: string, options: SendOptions = {}): Promise<SendResult> {
    const token = this.config.get<string>('telegram.botToken');
    if (!token) return 'SKIPPED';

    const button = options.button ? await this.buttonMarkup(options.button) : undefined;

    try {
      const response = await this.call(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...(button ? { reply_markup: { inline_keyboard: [[button]] } } : {}),
      });

      const body = (await response.json()) as { ok?: boolean; error_code?: number; description?: string };
      if (body.ok) return 'SENT';

      // 403 is the user's decision, not an error to retry. 400 with this text
      // means the chat never existed — the same situation, different wording.
      const unreachable =
        body.error_code === 403 || (body.description ?? '').includes('chat not found');
      if (unreachable) return 'BLOCKED';

      this.logger.warn(`sendMessage ${chatId}: ${body.error_code} ${body.description}`);
      return 'FAILED';
    } catch (error) {
      this.logger.warn(`sendMessage ${chatId} failed: ${String(error)}`);
      return 'FAILED';
    }
  }

  /**
   * `https://t.me/<bot>/<app>?startapp=<param>` opens the Mini App directly.
   * Without a configured short name we fall back to the bot's main Mini App
   * link, which works once one is set in BotFather. Null when the username
   * cannot be resolved — callers then show the bare code or no button at all,
   * rather than a link that opens nothing.
   */
  async miniAppLink(startParam?: string): Promise<string | null> {
    const username = await this.resolveBotUsername();
    if (!username) return null;

    const shortName = this.config.get<string>('telegram.miniAppShortName');
    const base = shortName ? `https://t.me/${username}/${shortName}` : `https://t.me/${username}`;
    return startParam ? `${base}?startapp=${startParam}` : base;
  }

  /** The plain chat with the bot — where someone goes to press Start. */
  async botLink(): Promise<string | null> {
    const username = await this.resolveBotUsername();
    return username ? `https://t.me/${username}` : null;
  }

  /**
   * Opens Telegram's own "add to group" picker. Deliberately not a deep link
   * we build ourselves: which chats a person may add a bot to is Telegram's
   * question to answer, and it already knows the list.
   */
  async addToGroupLink(): Promise<string | null> {
    const username = await this.resolveBotUsername();
    return username ? `https://t.me/${username}?startgroup=true` : null;
  }

  async resolveBotUsername(): Promise<string | null> {
    const configured = this.config.get<string>('telegram.botUsername');
    if (configured) return configured.replace(/^@/, '');
    if (this.botUsername) return this.botUsername;

    const token = this.config.get<string>('telegram.botToken');
    if (!token) return null;

    try {
      const response = await this.call(token, 'getMe', {});
      const body = (await response.json()) as { ok?: boolean; result?: { username?: string } };
      if (!body.ok || !body.result?.username) return null;
      this.botUsername = body.result.username;
      return this.botUsername;
    } catch (error) {
      // A failed lookup is not cached: the next request should try again.
      this.logger.warn(`Не удалось получить username бота: ${String(error)}`);
      return null;
    }
  }

  /** Escapes the three characters that would otherwise break HTML parse mode. */
  static escape(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private async buttonMarkup(button: { text: string; startParam?: string }) {
    const url = await this.miniAppLink(button.startParam);
    return url ? { text: button.text, url } : undefined;
  }

  private async call(token: string, method: string, payload: object): Promise<Response> {
    const base = this.config.get<string>('telegram.apiBase');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${base}/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Remembers that this chat is closed to us. Written by telegramId rather
   * than user id because the failure is reported against the chat, and the
   * webhook clears the same flag from the other direction when someone
   * presses Start again.
   */
  private async markBlocked(telegramId: string, blocked = true): Promise<void> {
    await this.prisma.user.updateMany({ where: { telegramId }, data: { botBlocked: blocked } });
  }

  /** In a private chat the chat id and the user's telegram id are the same number. */
  async markBlockedByChat(chatId: string): Promise<void> {
    await this.markBlocked(chatId, true);
  }

  async markReachable(telegramId: string): Promise<void> {
    await this.markBlocked(telegramId, false);
  }
}
