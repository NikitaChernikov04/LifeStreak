import type WebAppSdk from '@twa-dev/sdk';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: typeof WebAppSdk;
    };
  }
}

export {};
