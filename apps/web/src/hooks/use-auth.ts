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

import { useCallback, useEffect, useState, useRef } from 'react';
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
  
  // Auth store - use selectors for stable references
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const needsAuth = useAuthStore(selectNeedsAuth);
  const isConnected = useAuthStore(selectIsConnected);
  
  // Get stable function references from store (these are stable in Zustand)
  const setWalletConnected = useAuthStore((state) => state.setWalletConnected);
  const setWalletDisconnected = useAuthStore((state) => state.setWalletDisconnected);
  const storeSignOut = useAuthStore((state) => state.signOut);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const authenticate = useAuthStore((state) => state.authenticate);
  const clearError = useAuthStore((state) => state.clearError);
  const removeFromDevice = useAuthStore((state) => state.removeFromDevice);
  
  // Get state values
  const status = useAuthStore((state) => state.status);
  const walletAddress = useAuthStore((state) => state.walletAddress);
  const storeChainId = useAuthStore((state) => state.chainId);
  const session = useAuthStore((state) => state.session);
  const did = useAuthStore((state) => state.did);
  const publicKey = useAuthStore((state) => state.publicKey);
  const isNewUser = useAuthStore((state) => state.isNewUser);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const sessionWalletAddress = useAuthStore((state) => state.session?.walletAddress);

  // Track if we've initialized to prevent duplicate calls
  const hasInitialized = useRef(false);
  const lastProcessedAddress = useRef<string | null>(null);
  
  // Restore session on mount only (once)
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      restoreSession();
    }
  }, [restoreSession]);

  // Sync wagmi state with auth store
  useEffect(() => {
    if (wagmiConnected && address && chainId) {
      // Only call setWalletConnected if address changed
      if (lastProcessedAddress.current !== address.toLowerCase()) {
        lastProcessedAddress.current = address.toLowerCase();
        setWalletConnected(address, chainId);
      }
    } else if (!wagmiConnected && lastProcessedAddress.current !== null) {
      lastProcessedAddress.current = null;
      setWalletDisconnected();
    }
  }, [wagmiConnected, address, chainId, setWalletConnected, setWalletDisconnected]);
  
  // SECURITY: Verify wallet address matches session
  useEffect(() => {
    if (sessionWalletAddress && address) {
      if (sessionWalletAddress.toLowerCase() !== address.toLowerCase()) {
        // Wallet changed - security violation, sign out immediately
        storeSignOut();
      }
    }
  }, [address, sessionWalletAddress, storeSignOut]);

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
    setWalletDisconnected();
  }, [wagmiDisconnect, setWalletDisconnected]);

  /**
   * Authenticate with password
   * For new users, this also signs a message to link wallet to DID
   */
  const doAuthenticate = useCallback(async (password: string) => {
    // Create a sign function that uses wagmi's signMessageAsync
    const signFn = isNewUser 
      ? async (message: string) => signMessageAsync({ message })
      : undefined;
    
    await authenticate(password, signFn);
  }, [isNewUser, signMessageAsync, authenticate]);

  /**
   * Sign out (keeps wallet connected and stored key)
   */
  const signOut = useCallback(() => {
    storeSignOut();
  }, [storeSignOut]);

  /**
   * Clear error
   */
  const doClearError = useCallback(() => {
    clearError();
  }, [clearError]);

  /**
   * Remove user from device completely
   */
  const doRemoveFromDevice = useCallback(async () => {
    await removeFromDevice();
    wagmiDisconnect();
  }, [removeFromDevice, wagmiDisconnect]);

  return {
    // State
    status,
    isAuthenticated,
    isConnected,
    needsAuth,
    isLoading: isLoading || isPending,
    error,
    
    // User info
    walletAddress,
    chainId: storeChainId,
    did,
    publicKey,
    isNewUser,
    
    // Wallet actions
    connect,
    disconnect,
    
    // Auth actions
    authenticate: doAuthenticate,
    signOut,
    clearError: doClearError,
    removeFromDevice: doRemoveFromDevice,
    
    // Connectors
    connectors,
    pendingConnector: isPending,
  };
}

/**
 * Hook for checking if user can access protected content
 */
export function useRequireAuth(redirectTo = '/connect') {
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

