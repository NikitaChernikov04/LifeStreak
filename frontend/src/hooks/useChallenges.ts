import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DailyChallenge } from '@/types/api';
import { hapticNotification } from '@/lib/telegram';
import { useCelebrationStore } from '@/store/useCelebrationStore';

export function useTodayChallenge() {
  return useQuery({
    queryKey: ['challenge', 'today'],
    queryFn: () => api.get<unknown, DailyChallenge>('/challenges/today'),
  });
}

export function useCompleteChallenge() {
  const queryClient = useQueryClient();
  const pushCelebration = useCelebrationStore((s) => s.push);

  return useMutation({
    mutationFn: (challengeId: string) =>
      api.post<unknown, DailyChallenge>(`/challenges/${challengeId}/complete`),
    onSuccess: (challenge) => {
      hapticNotification('success');
      queryClient.invalidateQueries({ queryKey: ['challenge', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['hearts'] });
      if (challenge.template.rewardType === 'HEART') {
        pushCelebration({ type: 'heart', amount: 1 });
      }
    },
  });
}
