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
