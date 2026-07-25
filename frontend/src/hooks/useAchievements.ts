import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AchievementDefinition, UserAchievement } from '@/types/api';

export function useAllAchievements() {
  return useQuery({
    queryKey: ['achievements', 'all'],
    queryFn: () => api.get<unknown, AchievementDefinition[]>('/achievements'),
    staleTime: Infinity,
  });
}

export function useMyAchievements() {
  return useQuery({
    queryKey: ['achievements', 'me'],
    queryFn: () => api.get<unknown, UserAchievement[]>('/achievements/me'),
  });
}
