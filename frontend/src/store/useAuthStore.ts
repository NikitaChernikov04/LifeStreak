import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/api';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setSession: (accessToken: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (accessToken, user) => set({ accessToken, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    { name: 'lifestreak-auth' },
  ),
);
