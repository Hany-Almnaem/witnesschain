'use client';

/**
 * Connect Wallet Page
 * 
 * First step in the authentication flow.
 * Users connect their wallet (MetaMask, WalletConnect).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { WalletConnect } from '@/components/auth/wallet-connect';
import { useAuth } from '@/hooks/use-auth';

export default function ConnectPage() {
  const router = useRouter();
  const { status, isAuthenticated, isLoading } = useAuth();

  // Handle authentication state changes
  useEffect(() => {
    if (isLoading) return;

    // Already authenticated - go to dashboard
    if (isAuthenticated) {
      router.replace('/dashboard');
      return;
    }

    // Wallet connected - proceed to appropriate auth step
    switch (status) {
      case 'needs_password':
        router.replace('/unlock');
        break;
      case 'needs_setup':
        router.replace('/setup');
        break;
    }
  }, [status, isAuthenticated, isLoading, router]);

  return (
    <div className="flex flex-col items-center gap-8">
      <WalletConnect />

      {/* Privacy Note */}
      <div className="max-w-md text-center text-sm text-muted-foreground">
        <p>
          By connecting your wallet, you agree to WitnessChain&apos;s{' '}
          <a href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </a>
          .
        </p>
        <p className="mt-2">
          Your wallet address is used to generate a unique identity.
          Your private keys remain under your control.
        </p>
      </div>
    </div>
  );
}

