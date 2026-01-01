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
            staleTime: 1000 * 60 * 5, // 5 minutes - budget data doesn't change frequently
            cacheTime: 1000 * 60 * 10, // 10 minutes - keep cache longer for better navigation
            refetchOnWindowFocus: false,
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

