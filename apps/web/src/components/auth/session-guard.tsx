'use client';

/**
 * SessionGuard Component
 * 
 * Protects routes that require authentication.
 * Redirects to auth flow if not authenticated.
 * 
 * Usage:
 * ```tsx
 * <SessionGuard>
 *   <ProtectedContent />
 * </SessionGuard>
 * ```
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';

interface SessionGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Checking Authentication</h2>
          <p className="text-sm text-muted-foreground">
            Please wait while we verify your session...
          </p>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </div>
  );
}

/**
 * Session guard - redirects unauthenticated users
 */
export function SessionGuard({
  children,
  fallback,
  redirectTo = '/connect',
}: SessionGuardProps) {
  const router = useRouter();
  const { isAuthenticated, status, isLoading } = useAuth();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // Don't redirect if authenticating
    if (status === 'authenticating') return;

    // Redirect if not authenticated
    if (!isAuthenticated) {
      // Determine the appropriate auth page
      let targetPath = redirectTo;
      
      if (status === 'needs_password') {
        targetPath = '/unlock';
      } else if (status === 'needs_setup') {
        targetPath = '/setup';
      } else if (status === 'connected') {
        // Wallet connected but needs auth flow
        targetPath = '/setup';
      }

      router.replace(targetPath);
    }
  }, [isAuthenticated, status, isLoading, router, redirectTo]);

  // Show loading state while checking
  if (isLoading) {
    return fallback ?? <LoadingState />;
  }

  // Show loading while redirecting
  if (!isAuthenticated) {
    return fallback ?? <LoadingState />;
  }

  // Render protected content
  return <>{children}</>;
}

/**
 * Require wallet connection only (not full auth)
 */
export function WalletGuard({
  children,
  fallback,
  redirectTo = '/connect',
}: SessionGuardProps) {
  const router = useRouter();
  const { isConnected, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.replace(redirectTo);
    }
  }, [isConnected, isLoading, router, redirectTo]);

  if (isLoading || !isConnected) {
    return fallback ?? <LoadingState />;
  }

  return <>{children}</>;
}

/**
 * AuthRedirect - redirects authenticated users away (e.g., from login page)
 */
export function AuthRedirect({
  children,
  redirectTo = '/dashboard',
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (isAuthenticated) {
    return <LoadingState />;
  }

  return <>{children}</>;
}

/**
 * Higher-order component for protected pages
 */
export function withSessionGuard<P extends object>(
  Component: React.ComponentType<P>,
  options?: { redirectTo?: string }
) {
  return function ProtectedPage(props: P) {
    return (
      <SessionGuard redirectTo={options?.redirectTo}>
        <Component {...props} />
      </SessionGuard>
    );
  };
}

