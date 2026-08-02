import WebApp from '@twa-dev/sdk';

const isInTelegram = typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData);

export function initTelegramApp() {
  if (!isInTelegram) return;
  WebApp.ready();
  WebApp.expand();
  // Paper, so the Telegram chrome reads as the edge of the same sheet.
  // Keep in sync with --paper in index.css.
  WebApp.setHeaderColor('#F4F1E7');
  WebApp.setBackgroundColor('#F4F1E7');
  WebApp.disableVerticalSwipes?.();
}

export function getInitData(): string {
  if (isInTelegram) return WebApp.initData;
  // Local browser dev fallback — mirrors the shape Telegram sends, consumed
  // only when the backend has TELEGRAM_SKIP_AUTH_VALIDATION=true, which
  // production does not set.
  //
  // `?devUser=<name>` picks a different identity, so anything involving two
  // people — following, requests, reactions — can be walked through in two
  // browser tabs instead of two phones.
  const params = new URLSearchParams(window.location.search);
  const alias = params.get('devUser');
  const devUser = alias
    ? {
        id: 999000000 + (hashCode(alias) % 900000),
        first_name: alias,
        username: `dev_${alias.toLowerCase()}`,
        language_code: 'ru',
      }
    : {
        id: 999000001,
        first_name: 'Демо',
        last_name: 'Пользователь',
        username: 'lifestreak_demo',
        language_code: 'ru',
      };

  return `user=${encodeURIComponent(JSON.stringify(devUser))}&auth_date=${Math.floor(
    Date.now() / 1000,
  )}&hash=dev`;
}

/** Stable per-alias id, so reloading keeps the same dev account. */
function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/**
 * The invite code, when the app was opened from a `?startapp=<code>` link.
 * Outside Telegram the same parameter is read from the query string so the
 * flow can be exercised in a browser.
 */
export function getStartParam(): string | null {
  if (isInTelegram) return WebApp.initDataUnsafe?.start_param ?? null;
  const params = new URLSearchParams(window.location.search);
  return params.get('startapp') ?? params.get('tgWebAppStartParam');
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
  if (isInTelegram) WebApp.HapticFeedback.impactOccurred(style);
}

export function hapticNotification(type: 'error' | 'success' | 'warning') {
  if (isInTelegram) WebApp.HapticFeedback.notificationOccurred(type);
}

export function shareToTelegram(text: string, url?: string) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url ?? '')}&text=${encodeURIComponent(
    text,
  )}`;
  if (isInTelegram) {
    WebApp.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, '_blank');
  }
}

/**
 * Opens a t.me link. Inside Telegram this hands off to the client, which keeps
 * the Mini App alive behind the chat instead of leaving it in a browser tab.
 */
export function openTelegramLink(url: string) {
  if (isInTelegram) {
    WebApp.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}

export { isInTelegram };
export default WebApp;
