import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { HeartsBalance } from '@/types/api';

export function useHearts() {
  return useQuery({
    queryKey: ['hearts'],
    queryFn: () => api.get<unknown, HeartsBalance>('/hearts'),
  });
}
