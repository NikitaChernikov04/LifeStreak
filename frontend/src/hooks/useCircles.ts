import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { hapticImpact } from '@/lib/telegram';
import type { CirclesResponse } from '@/types/api';

const KEY = ['circles'] as const;

export function useCircles() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<unknown, CirclesResponse>('/circles'),
  });
}

/**
 * Leaving is optimistic on purpose. The list is short and the action is one a
 * person takes because they want out now — watching the row sit there while
 * the request travels reads as the app arguing.
 */
export function useLeaveCircle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (circleId: string) => api.delete<unknown, { left: boolean }>(`/circles/${circleId}`),
    onMutate: async (circleId) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<CirclesResponse>(KEY);
      if (previous) {
        queryClient.setQueryData<CirclesResponse>(KEY, {
          ...previous,
          circles: previous.circles.filter((circle) => circle.id !== circleId),
        });
      }
      hapticImpact('light');
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
