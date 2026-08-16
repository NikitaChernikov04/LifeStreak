import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CheckinResponse, Streak, StreakTemplate } from '@/types/api';
import { useCelebrationStore } from '@/store/useCelebrationStore';
import { useAuthStore } from '@/store/useAuthStore';
import { hapticNotification } from '@/lib/telegram';

export function useStreaks() {
  return useQuery({
    queryKey: ['streaks'],
    queryFn: () => api.get<unknown, Streak[]>('/streaks'),
  });
}

export function useStreakTemplates() {
  return useQuery({
    queryKey: ['streak-templates'],
    queryFn: () => api.get<unknown, StreakTemplate[]>('/streaks/templates'),
    staleTime: Infinity,
  });
}

export interface CreateStreakInput {
  title: string;
  icon: string;
  color: string;
  templateKey?: string;
  /** Days already accumulated elsewhere, counted as finished through yesterday. */
  startingCount?: number;
}

export function useCreateStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStreakInput) => api.post<unknown, Streak>('/streaks', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streaks'] });
    },
  });
}

export function useArchiveStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (streakId: string) => api.delete<unknown, Streak>(`/streaks/${streakId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streaks'] });
    },
  });
}

export function useCheckinStreak() {
  const queryClient = useQueryClient();
  const pushCelebration = useCelebrationStore((s) => s.push);
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (streak: Streak) =>
      api.post<unknown, CheckinResponse>(`/streaks/${streak.id}/checkin`).then((result) => ({
        result,
        streak,
      })),
    onSuccess: ({ result, streak }) => {
      hapticNotification('success');

      // The response already carries the updated streak, so the card can be
      // corrected from it instead of waiting for a refetch. Invalidating
      // `streaks` alone meant the number the user just earned appeared only
      // after a second round trip — the press, then a wait, then the change.
      queryClient.setQueryData<Streak[]>(['streaks'], (current) =>
        current?.map((s) => (s.id === result.streak.id ? result.streak : s)),
      );
      // Profile and statistics are not on screen at this moment; they refetch
      // in the background rather than in front of the person who pressed.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });

      if (user) {
        setUser({ ...user, xp: user.xp + result.xpEarned, level: result.newLevel });
      }
      if (result.unlockedMilestone) {
        pushCelebration({
          type: 'milestone',
          days: result.streak.currentCount,
          icon: streak.icon,
          title: streak.title,
        });
      }
      if (result.leveledUp) {
        pushCelebration({ type: 'levelup', level: result.newLevel });
      }
      if (result.heartGranted) {
        pushCelebration({ type: 'heart', amount: 1 });
      }
    },
  });
}

export function useRecoverStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (streakId: string) => api.post<unknown, Streak>(`/streaks/${streakId}/recover`),
    onSuccess: () => {
      hapticNotification('success');
      queryClient.invalidateQueries({ queryKey: ['streaks'] });
      queryClient.invalidateQueries({ queryKey: ['hearts'] });
    },
  });
}
