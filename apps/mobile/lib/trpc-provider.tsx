import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { trpc } from './trpc';
import Constants from 'expo-constants';

function getBaseUrl() {
  // In development, use your local machine's IP address
  // You can get this by running `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
  // and looking for your local network IP (usually 192.168.x.x or 10.0.x.x)

  // For Expo Go on a physical device or emulator
  const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];

  if (debuggerHost) {
    // Use the same host as the Expo dev server
    return `http://${debuggerHost}:3000`;
  }

  // Fallback for production or when debuggerHost is not available
  // You should set EXPO_PUBLIC_API_URL in your .env file
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            retry: 1,
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
          headers() {
            return {
              'x-trpc-source': 'mobile',
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
