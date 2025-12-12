'use client';

/**
 * WalletConnect Component
 * 
 * Handles wallet connection UI with support for:
 * - MetaMask (injected)
 * - WalletConnect (if project ID configured)
 * 
 * Shows connection status and handles errors gracefully.
 */

import { useCallback } from 'react';
import { useConnect } from 'wagmi';
import { Wallet, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WalletConnectProps {
  onConnect?: () => void;
  className?: string;
}

/**
 * Connector metadata for UI display
 */
const CONNECTOR_META: Record<string, { name: string; icon: string; description: string }> = {
  injected: {
    name: 'MetaMask',
    icon: '🦊',
    description: 'Connect with MetaMask browser extension',
  },
  walletConnect: {
    name: 'WalletConnect',
    icon: '🔗',
    description: 'Connect with mobile wallet via QR code',
  },
};

export function WalletConnect({ onConnect, className }: WalletConnectProps) {
  const { connectors, connect, isPending, error } = useConnect();

  const handleConnect = useCallback(
    (connectorId: string) => {
      const connector = connectors.find((c) => c.id === connectorId);
      if (connector) {
        connect(
          { connector },
          {
            onSuccess: () => {
              onConnect?.();
            },
          }
        );
      }
    },
    [connectors, connect, onConnect]
  );

  // Filter to supported connectors
  const supportedConnectors = connectors.filter(
    (c) => c.id === 'injected' || c.id === 'walletConnect'
  );

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Wallet className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Connect Your Wallet</CardTitle>
        <CardDescription>
          Choose a wallet to connect to WitnessChain. Your identity remains
          pseudonymous and secure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{getErrorMessage(error)}</p>
          </div>
        )}

        {/* Connector Buttons */}
        <div className="space-y-3">
          {supportedConnectors.map((connector) => {
            const meta = CONNECTOR_META[connector.id] ?? {
              name: connector.name,
              icon: '🔌',
              description: `Connect with ${connector.name}`,
            };

            return (
              <button
                key={connector.id}
                onClick={() => handleConnect(connector.id)}
                disabled={isPending}
                className={cn(
                  'flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                <span className="text-2xl">{meta.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{meta.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {meta.description}
                  </div>
                </div>
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>

        {/* Calibration Network Note */}
        <div className="mt-6 rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          <p className="font-medium">Filecoin Calibration Testnet</p>
          <p className="mt-1">
            Using test network for development. No real FIL required.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('user rejected') || message.includes('user denied')) {
    return 'Connection request was rejected. Please try again.';
  }

  if (message.includes('already pending')) {
    return 'A connection request is already pending. Check your wallet.';
  }

  if (message.includes('no provider')) {
    return 'No wallet detected. Please install MetaMask or another Web3 wallet.';
  }

  if (message.includes('chain')) {
    return 'Please switch to the Filecoin network in your wallet.';
  }

  return 'Failed to connect wallet. Please try again.';
}

/**
 * Compact wallet connect button for header/nav
 */
export function WalletConnectButton({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { connectors, connect, isPending } = useConnect();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }

    // Default: connect with injected wallet
    const injected = connectors.find((c) => c.id === 'injected');
    if (injected) {
      connect({ connector: injected });
    }
  }, [connectors, connect, onClick]);

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      className={className}
      variant="default"
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </>
      )}
    </Button>
  );
}

