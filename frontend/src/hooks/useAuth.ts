import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/types/api';

interface LoginResponse {
  accessToken: string;
  user: User;
}

export function useTelegramLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (initData: string) => api.post<unknown, LoginResponse>('/auth/telegram', { initData }),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
    },
  });
}

/** The prefix a `startapp` value must carry to be read as a demo key. */
export const DEMO_START_PREFIX = 'demo_';

/**
 * Signs in as the fictional demo account, for recording a walkthrough without
 * putting real people's records on video.
 *
 * The key travels in the Mini App's start parameter, so the demo opens as the
 * real app inside Telegram rather than as a web page — which is the whole
 * point when the recording is meant to show the product.
 */
export function useDemoLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (secret: string) => api.post<unknown, LoginResponse>('/auth/demo', { secret }),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user, true);
    },
  });
}
