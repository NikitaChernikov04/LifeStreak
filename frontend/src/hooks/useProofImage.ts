import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * A proof photo, fetched rather than linked.
 *
 * It cannot be an `<img src>` pointing at the API: the blob store is private
 * and the route wants the bearer token, which a plain tag will not send. That
 * is the trade for the guarantee — there is no address for this photo that
 * works without being in the goal. So the bytes come back like any other
 * request and are handed to the tag as an object URL.
 */
export function useProofImage(goalId: string, checkinId: string, enabled: boolean) {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['proof-image', goalId, checkinId],
    enabled,
    // The photo for a given day never changes; refetching it would be paying
    // to move the same bytes twice.
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    // The bytes come from storage over the network, and that hop does fail on
    // a bad connection. Without a retry one blink leaves the photo broken for
    // as long as the card stays on screen.
    retry: 2,
    retryDelay: (attempt) => 600 * 2 ** attempt,
    queryFn: () =>
      api.get<unknown, Blob>(`/social/goals/${goalId}/proofs/${checkinId}/image`, {
        responseType: 'blob',
      }),
  });

  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const objectUrl = URL.createObjectURL(data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data]);

  return { url, isPending: enabled && isPending, isError, isFetching, retry: refetch };
}
