'use client';

/**
 * Unlock Page
 * 
 * For existing users who need to enter their password
 * to unlock their encrypted keys.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PasswordPrompt } from '@/components/auth/password-prompt';
import { useAuth } from '@/hooks/use-auth';

export default function UnlockPage() {
  const router = useRouter();
  const {
    status,
    isAuthenticated,
    isLoading,
    walletAddress,
    did,
    error,
    authenticate,
    clearError,
    disconnect,
  } = useAuth();

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    // Already authenticated - go to dashboard
    if (isAuthenticated) {
      router.replace('/dashboard');
      return;
    }

    // No wallet connected - go to connect page
    if (status === 'disconnected') {
      router.replace('/connect');
      return;
    }

    // New user - go to setup page
    if (status === 'needs_setup') {
      router.replace('/setup');
      return;
    }
  }, [status, isAuthenticated, isLoading, router]);

  // Handle password submission
  const handleSubmit = async (password: string) => {
    await authenticate(password);
  };

  // Cancel and go back
  const handleCancel = () => {
    disconnect();
    router.replace('/connect');
  };

  // Clear error after delay
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(clearError, 5000);
      return () => clearTimeout(timeout);
    }
  }, [error, clearError]);

  // Show nothing while checking status
  if (isLoading || status !== 'needs_password') {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <PasswordPrompt
        mode="unlock"
        walletAddress={walletAddress ?? undefined}
        did={did ?? undefined}
        isLoading={isLoading}
        error={error}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />

      {/* Help Section */}
      <div className="max-w-md space-y-4 text-center text-sm text-muted-foreground">
        <p>
          Enter the password you created when setting up your WitnessChain identity.
        </p>
        <p>
          <button
            onClick={handleCancel}
            className="text-primary underline hover:text-primary/80"
          >
            Use a different wallet
          </button>
        </p>
      </div>
    </div>
  );
}

