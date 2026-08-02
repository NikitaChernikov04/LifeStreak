import { create } from 'zustand';
import type { AchievementDefinition } from '@/types/api';

export type CelebrationEvent =
  | { type: 'levelup'; level: number }
  | { type: 'achievement'; achievement: AchievementDefinition }
  | { type: 'heart'; amount: number }
  | { type: 'milestone'; days: number; icon: string; title: string; note?: string };

interface CelebrationState {
  queue: CelebrationEvent[];
  push: (event: CelebrationEvent) => void;
  shift: () => void;
}

export const useCelebrationStore = create<CelebrationState>((set) => ({
  queue: [],
  push: (event) => set((s) => ({ queue: [...s.queue, event] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));
