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
  // only when the backend has TELEGRAM_SKIP_AUTH_VALIDATION=true.
  const devUser = {
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

export { isInTelegram };
export default WebApp;
