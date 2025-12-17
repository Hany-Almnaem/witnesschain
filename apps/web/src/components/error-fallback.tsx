'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * Error fallback component for ErrorBoundary
 * Displays a user-friendly error message without exposing internal details
 */
export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  // Only show generic message to avoid exposing internals
  const isNetworkError = error.message?.toLowerCase().includes('network');
  
  const userMessage = isNetworkError
    ? 'Unable to connect. Please check your internet connection.'
    : 'Something went wrong. Please try again.';

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mt-6 text-xl font-semibold">Oops! Something went wrong</h2>
        <p className="mt-2 max-w-md text-muted-foreground">{userMessage}</p>
        <div className="mt-8 flex gap-4">
          <Button onClick={resetErrorBoundary} variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="outline"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
