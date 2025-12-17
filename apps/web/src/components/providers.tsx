'use client';

/**
 * Root Providers Component
 * 
 * Wraps the application with all necessary context providers:
 * - React Query for data fetching
 * - Wagmi for wallet connection
 * - Error Boundary for error handling
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { WagmiProvider } from 'wagmi';

import { ErrorFallback } from '@/components/error-fallback';
import { getWagmiConfig } from '@/lib/wagmi';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Create a stable QueryClient instance
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  // Get wagmi config
  const wagmiConfig = getWagmiConfig();

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}
