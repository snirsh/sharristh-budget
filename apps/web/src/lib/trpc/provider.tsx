'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { trpc } from './client';

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute - more responsive to data changes
            // @ts-expect-error - gcTime exists in newer versions but types may not be updated
            gcTime: 1000 * 60 * 5, // 5 minutes - keep cache for navigation (renamed from cacheTime)
            refetchOnWindowFocus: true, // Refetch when user returns to tab for fresh data
            refetchOnMount: false, // Don't refetch if data is fresh (within staleTime)
            retry: 1, // Only retry failed requests once to avoid long delays
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          maxURLLength: 2048, // Prevent overly long URLs

          // Batch requests within 10ms window for better performance
          // This groups multiple queries into a single HTTP request
          // @ts-expect-error - batchingInterval exists but types may not be updated
          batchingInterval: 10,

          headers() {
            return {
              'x-trpc-source': 'client',
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
