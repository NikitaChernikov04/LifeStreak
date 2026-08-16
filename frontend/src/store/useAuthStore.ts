import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/api';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  /**
   * This session came from the demo entrance rather than from Telegram. Kept
   * so the app can say so out loud on the profile sheet: a session that is not
   * yours should never be silent about it, least of all one that survives a
   * reload.
   */
  isDemo: boolean;
  setSession: (accessToken: string, user: User, isDemo?: boolean) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isDemo: false,
      setSession: (accessToken, user, isDemo = false) => set({ accessToken, user, isDemo }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, user: null, isDemo: false }),
    }),
    { name: 'lifestreak-auth' },
  ),
);
