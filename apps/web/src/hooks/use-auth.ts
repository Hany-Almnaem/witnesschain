/**
 * useAuth Hook
 * 
 * Unified authentication hook that combines wagmi wallet state
 * with WitnessChain's DID-based authentication.
 * 
 * Usage:
 * ```tsx
 * const { 
 *   isAuthenticated, 
 *   connect, 
 *   authenticate, 
 *   signOut,
 *   walletAddress,
 *   did,
 * } = useAuth();
 * ```
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';

import { 
  useAuthStore, 
  selectIsAuthenticated, 
  selectNeedsAuth,
  selectIsConnected,
  type AuthStatus,
} from '@/stores/auth-store';

/**
 * Auth hook return type
 */
export interface UseAuthReturn {
  // State
  status: AuthStatus;
  isAuthenticated: boolean;
  isConnected: boolean;
  needsAuth: boolean;
  isLoading: boolean;
  error: string | null;
  
  // User info
  walletAddress: string | null;
  chainId: number | null;
  did: string | null;
  publicKey: string | null;
  isNewUser: boolean;
  
  // Wallet actions
  connect: () => void;
  disconnect: () => void;
  
  // Auth actions
  authenticate: (password: string) => Promise<void>;
  signOut: () => void;
  clearError: () => void;
  removeFromDevice: () => Promise<void>;
  
  // Connectors
  connectors: ReturnType<typeof useConnect>['connectors'];
  pendingConnector: ReturnType<typeof useConnect>['isPending'];
}

/**
 * Main authentication hook
 */
export function useAuth(): UseAuthReturn {
  // Wagmi hooks
  const { address, chainId, isConnected: wagmiConnected } = useAccount();
  const { connect: wagmiConnect, connectors, isPending } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  
  // Auth store
  const store = useAuthStore();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const needsAuth = useAuthStore(selectNeedsAuth);
  const isConnected = useAuthStore(selectIsConnected);

  // Sync wagmi state with auth store
  useEffect(() => {
    if (wagmiConnected && address && chainId) {
      store.setWalletConnected(address, chainId);
    } else if (!wagmiConnected) {
      store.setWalletDisconnected();
    }
  }, [wagmiConnected, address, chainId, store]);

  // Restore session on mount
  useEffect(() => {
    store.restoreSession();
  }, [store]);

  /**
   * Connect wallet using injected connector (MetaMask)
   */
  const connect = useCallback(() => {
    const injectedConnector = connectors.find(c => c.id === 'injected');
    if (injectedConnector) {
      wagmiConnect({ connector: injectedConnector });
    } else if (connectors.length > 0) {
      wagmiConnect({ connector: connectors[0] });
    }
  }, [wagmiConnect, connectors]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    wagmiDisconnect();
    store.setWalletDisconnected();
  }, [wagmiDisconnect, store]);

  /**
   * Authenticate with password
   * For new users, this also signs a message to link wallet to DID
   */
  const authenticate = useCallback(async (password: string) => {
    // Create a sign function that uses wagmi's signMessageAsync
    const signFn = store.isNewUser 
      ? async (message: string) => signMessageAsync({ message })
      : undefined;
    
    await store.authenticate(password, signFn);
  }, [store, signMessageAsync]);

  /**
   * Sign out (keeps wallet connected and stored key)
   */
  const signOut = useCallback(() => {
    store.signOut();
  }, [store]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    store.clearError();
  }, [store]);

  /**
   * Remove user from device completely
   */
  const removeFromDevice = useCallback(async () => {
    await store.removeFromDevice();
    wagmiDisconnect();
  }, [store, wagmiDisconnect]);

  return {
    // State
    status: store.status,
    isAuthenticated,
    isConnected,
    needsAuth,
    isLoading: store.isLoading || isPending,
    error: store.error,
    
    // User info
    walletAddress: store.walletAddress,
    chainId: store.chainId,
    did: store.did,
    publicKey: store.publicKey,
    isNewUser: store.isNewUser,
    
    // Wallet actions
    connect,
    disconnect,
    
    // Auth actions
    authenticate,
    signOut,
    clearError,
    removeFromDevice,
    
    // Connectors
    connectors,
    pendingConnector: isPending,
  };
}

/**
 * Hook for checking if user can access protected content
 */
export function useRequireAuth(redirectTo = '/auth/connect') {
  const { isAuthenticated, status, isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated && status !== 'authenticating') {
      // Using window.location for navigation to avoid Next.js router issues
      if (typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
    }
  }, [isAuthenticated, status, isLoading, redirectTo]);

  return { isAuthenticated, isLoading };
}

/**
 * Hook for password-protected operations
 * Returns a function that requires password before executing
 */
export function useProtectedAction<T>(
  action: (secretKey: Uint8Array) => Promise<T>
) {
  const { did } = useAuth();
  const [isPrompting, setIsPrompting] = useState(false);
  
  const execute = useCallback(async (password: string): Promise<T | null> => {
    if (!did) {
      throw new Error('Not authenticated');
    }
    
    const { retrieveSecretKey } = await import('@/lib/key-storage');
    const secretKey = await retrieveSecretKey(did, password);
    
    if (!secretKey) {
      throw new Error('Invalid password');
    }
    
    try {
      return await action(secretKey);
    } finally {
      // Clear secret key from memory after use
      secretKey.fill(0);
    }
  }, [did, action]);

  return { execute, isPrompting, setIsPrompting };
}

