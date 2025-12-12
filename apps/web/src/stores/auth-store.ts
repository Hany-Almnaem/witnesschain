/**
 * Authentication Store (Zustand)
 * 
 * Manages authentication state across the application.
 * Integrates with wagmi for wallet state and custom auth logic for DID/keys.
 * 
 * State is NOT persisted - session is managed separately via sessionStorage
 * to ensure sensitive data handling follows security best practices.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Session } from '@witnesschain/shared';

import {
  getSession,
  setSession,
  clearSession,
  getDIDForWallet,
  userExistsForWallet,
  authenticateUser,
  signOut as authSignOut,
  removeUserFromDevice,
  AuthError,
} from '@/lib/auth';
import { RateLimitError } from '@/lib/key-storage';

/**
 * Authentication status
 */
export type AuthStatus = 
  | 'disconnected'     // No wallet connected
  | 'connected'        // Wallet connected, but not authenticated
  | 'needs_password'   // Existing user, needs password to unlock
  | 'needs_setup'      // New user, needs to create password
  | 'authenticating'   // In progress
  | 'authenticated';   // Fully authenticated

/**
 * Auth store state
 */
export interface AuthState {
  // Connection state
  status: AuthStatus;
  walletAddress: string | null;
  chainId: number | null;
  
  // Authentication state
  session: Session | null;
  did: string | null;
  publicKey: string | null;
  isNewUser: boolean;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setWalletConnected: (address: string, chainId: number) => Promise<void>;
  setWalletDisconnected: () => void;
  authenticate: (password: string, signMessage?: (message: string) => Promise<string>) => Promise<void>;
  signOut: () => void;
  clearError: () => void;
  removeFromDevice: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

/**
 * Auth store
 */
export const useAuthStore = create<AuthState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    status: 'disconnected',
    walletAddress: null,
    chainId: null,
    session: null,
    did: null,
    publicKey: null,
    isNewUser: false,
    isLoading: false,
    error: null,

    /**
     * Called when wallet connects
     * Checks if user exists and sets appropriate status
     */
    setWalletConnected: async (address: string, chainId: number) => {
      const normalizedAddress = address.toLowerCase();
      
      set({
        walletAddress: normalizedAddress,
        chainId,
        isLoading: true,
        error: null,
      });

      try {
        // Check if user already exists for this wallet
        const existingDid = getDIDForWallet(normalizedAddress);
        const userExists = existingDid ? await userExistsForWallet(normalizedAddress) : false;
        
        // Check for existing session
        const existingSession = getSession();
        if (existingSession && existingSession.walletAddress === normalizedAddress) {
          // Resume existing session
          set({
            status: 'authenticated',
            session: existingSession,
            did: existingSession.did,
            isLoading: false,
          });
          return;
        }

        // Determine next status
        if (userExists && existingDid) {
          set({
            status: 'needs_password',
            did: existingDid,
            isNewUser: false,
            isLoading: false,
          });
        } else {
          set({
            status: 'needs_setup',
            isNewUser: true,
            isLoading: false,
          });
        }
      } catch (error) {
        set({
          status: 'connected',
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to check user status',
        });
      }
    },

    /**
     * Called when wallet disconnects
     */
    setWalletDisconnected: () => {
      // Clear session when wallet disconnects
      clearSession();
      
      set({
        status: 'disconnected',
        walletAddress: null,
        chainId: null,
        session: null,
        did: null,
        publicKey: null,
        isNewUser: false,
        error: null,
      });
    },

    /**
     * Authenticate with password
     */
    authenticate: async (password: string, signMessage?: (msg: string) => Promise<string>) => {
      const { walletAddress } = get();
      
      if (!walletAddress) {
        set({ error: 'No wallet connected' });
        return;
      }

      set({ isLoading: true, error: null });

      try {
        const result = await authenticateUser(walletAddress, password, signMessage);
        
        // Get the newly created session
        const session = getSession();
        
        set({
          status: 'authenticated',
          session,
          did: result.did,
          publicKey: result.publicKey,
          isNewUser: result.isNewUser,
          isLoading: false,
        });
      } catch (error) {
        let errorMessage = 'Authentication failed';
        
        if (error instanceof RateLimitError) {
          // Rate limit error - show remaining time
          errorMessage = `Too many failed attempts. Please wait ${error.remainingSeconds} seconds.`;
        } else if (error instanceof AuthError) {
          switch (error.code) {
            case 'AUTH_INVALID_PASSWORD':
              errorMessage = 'Invalid password. Please try again.';
              break;
            case 'AUTH_SIGNATURE_REJECTED':
              errorMessage = 'Signature was rejected. Please try again.';
              break;
            case 'AUTH_REGISTRATION_FAILED':
              errorMessage = 'Failed to register. Please try again.';
              break;
            default:
              errorMessage = error.message;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        set({
          isLoading: false,
          error: errorMessage,
        });
      }
    },

    /**
     * Sign out (keep stored key)
     */
    signOut: () => {
      authSignOut();
      
      const { walletAddress, chainId } = get();
      
      set({
        status: walletAddress ? 'needs_password' : 'disconnected',
        session: null,
        publicKey: null,
        error: null,
      });
    },

    /**
     * Clear error message
     */
    clearError: () => {
      set({ error: null });
    },

    /**
     * Remove user completely from device
     */
    removeFromDevice: async () => {
      set({ isLoading: true });
      
      try {
        await removeUserFromDevice();
        
        set({
          status: 'disconnected',
          walletAddress: null,
          chainId: null,
          session: null,
          did: null,
          publicKey: null,
          isNewUser: false,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to remove user',
        });
      }
    },

    /**
     * Restore session on app load
     */
    restoreSession: async () => {
      const session = getSession();
      
      if (session) {
        set({
          session,
          did: session.did,
          // Status will be set when wallet reconnects
        });
      }
    },
  }))
);

/**
 * Selectors for common state slices
 */
export const selectIsAuthenticated = (state: AuthState) => 
  state.status === 'authenticated' && state.session !== null;

export const selectNeedsAuth = (state: AuthState) =>
  state.status === 'needs_password' || state.status === 'needs_setup';

export const selectIsConnected = (state: AuthState) =>
  state.walletAddress !== null;

export const selectAuthStatus = (state: AuthState) => ({
  status: state.status,
  isLoading: state.isLoading,
  error: state.error,
});

