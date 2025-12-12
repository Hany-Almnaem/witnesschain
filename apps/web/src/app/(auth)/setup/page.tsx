'use client';

/**
 * Setup Page
 * 
 * New user setup flow:
 * 1. Create password for key encryption
 * 2. Generate DID
 * 3. Sign message to link wallet to DID
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PasswordPrompt } from '@/components/auth/password-prompt';
import { useAuth } from '@/hooks/use-auth';

export default function SetupPage() {
  const router = useRouter();
  const { 
    status, 
    isAuthenticated, 
    isLoading, 
    walletAddress,
    error,
    authenticate,
    clearError,
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
      router.replace('/auth/connect');
      return;
    }

    // Existing user - go to unlock page
    if (status === 'needs_password') {
      router.replace('/auth/unlock');
      return;
    }
  }, [status, isAuthenticated, isLoading, router]);

  // Handle password creation
  const handleSubmit = async (password: string) => {
    await authenticate(password);
  };

  // Cancel and disconnect
  const handleCancel = () => {
    router.replace('/auth/connect');
  };

  // Clear error when user starts typing
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(clearError, 5000);
      return () => clearTimeout(timeout);
    }
  }, [error, clearError]);

  // Show loading while checking status
  if (isLoading || status === 'disconnected') {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <PasswordPrompt
        mode="create"
        walletAddress={walletAddress ?? undefined}
        isLoading={isLoading}
        error={error}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />

      {/* Info Section */}
      <div className="max-w-md space-y-4 text-center text-sm text-muted-foreground">
        <div>
          <h3 className="font-medium text-foreground">What happens next?</h3>
          <p className="mt-1">
            A unique identity will be generated for your wallet.
            You&apos;ll be asked to sign a message to verify ownership.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-foreground">About your password</h3>
          <p className="mt-1">
            Your password encrypts your private keys locally on this device.
            WitnessChain cannot recover your password if you forget it.
          </p>
        </div>
      </div>
    </div>
  );
}

