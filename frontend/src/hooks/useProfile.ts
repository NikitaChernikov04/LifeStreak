import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Statistics, User } from '@/types/api';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<unknown, User>('/users/me'),
  });
}

export function useStatistics() {
  return useQuery({
    queryKey: ['statistics'],
    queryFn: () => api.get<unknown, Statistics>('/statistics/me'),
  });
}
