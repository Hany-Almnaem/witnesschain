/**
 * Authentication Module
 * 
 * Implements the complete authentication flow:
 * 1. Wallet connection (MetaMask/WalletConnect)
 * 2. DID generation (new users) or retrieval (existing users)
 * 3. Password-protected key storage
 * 4. Session management
 * 
 * Security principles:
 * - Keys never stored in plaintext
 * - Session only stores DID and wallet address (not secrets)
 * - Password required for any key operations
 */

import type { Session } from '@witnesschain/shared';
import { generateNonce } from '@witnesschain/shared';

import { generateDIDKeyPair, restoreDIDFromSecretKey, createLinkingChallenge, getEncryptionPublicKey } from './did';
import { 
  storeSecretKey, 
  retrieveSecretKey, 
  hasSecretKey, 
  deleteSecretKey,
  verifyPassword,
} from './key-storage';
import { getApiUrl } from './env';

/**
 * Storage keys for wallet-DID mapping
 * This mapping is public info (only stores DID, not secrets)
 */
const WALLET_DID_PREFIX = 'witnesschain:did:';
const SESSION_KEY = 'witnesschain:session';

/**
 * Session duration in milliseconds (30 minutes)
 * After this time, user must re-authenticate with password
 */
const SESSION_DURATION_MS = 30 * 60 * 1000;

/**
 * Get stored DID for a wallet address
 * Returns null if wallet has no associated DID
 */
export function getDIDForWallet(walletAddress: string): string | null {
  if (typeof window === 'undefined') return null;
  
  const normalizedAddress = walletAddress.toLowerCase();
  return localStorage.getItem(`${WALLET_DID_PREFIX}${normalizedAddress}`);
}

/**
 * Store wallet-DID mapping
 * This is public info - safe to store in localStorage
 */
export function setDIDForWallet(walletAddress: string, did: string): void {
  if (typeof window === 'undefined') return;
  
  const normalizedAddress = walletAddress.toLowerCase();
  localStorage.setItem(`${WALLET_DID_PREFIX}${normalizedAddress}`, did);
}

/**
 * Clear wallet-DID mapping
 */
export function clearDIDForWallet(walletAddress: string): void {
  if (typeof window === 'undefined') return;
  
  const normalizedAddress = walletAddress.toLowerCase();
  localStorage.removeItem(`${WALLET_DID_PREFIX}${normalizedAddress}`);
}

/**
 * Get current session
 * Returns null if session doesn't exist or has expired
 */
export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  
  const sessionData = sessionStorage.getItem(SESSION_KEY);
  if (!sessionData) return null;
  
  try {
    const session = JSON.parse(sessionData) as Session;
    
    // Check if session has expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      // Session expired - clear it and return null
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

/**
 * Set current session
 */
export function setSession(session: Session): void {
  if (typeof window === 'undefined') return;
  
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Clear current session
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Create a new session with proper expiration
 * Internal helper to ensure consistent session creation
 */
function createSession(did: string, walletAddress: string): Session {
  const now = Date.now();
  return {
    did,
    walletAddress,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };
}

/**
 * Get remaining session time in seconds
 * Returns 0 if session is expired or doesn't exist
 */
export function getSessionRemainingTime(): number {
  const session = getSession();
  if (!session || !session.expiresAt) return 0;
  
  const remaining = session.expiresAt - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Check if session is expiring soon (within 5 minutes)
 * Useful for showing re-authentication warnings
 */
export function isSessionExpiringSoon(): boolean {
  const remaining = getSessionRemainingTime();
  return remaining > 0 && remaining < 5 * 60; // Less than 5 minutes
}

/**
 * Refresh session expiration (extend by another SESSION_DURATION_MS)
 * Only works if session exists and is valid
 */
export function refreshSession(): boolean {
  const session = getSession();
  if (!session) return false;
  
  // Create new session with refreshed expiration
  setSession(createSession(session.did, session.walletAddress));
  return true;
}

/**
 * Check if user is authenticated
 * Authentication requires both a session and the ability to verify the key exists
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  
  // Verify the key exists for this DID
  return hasSecretKey(session.did);
}

/**
 * Authentication result
 */
export interface AuthResult {
  did: string;
  /** Ed25519 public key for DID/signing (base64) */
  publicKey: string;
  /** X25519 public key for encryption (base64) */
  encryptionPublicKey: string;
  isNewUser: boolean;
}

/**
 * Authenticate a user (new or existing)
 * 
 * Flow for new users:
 * 1. Generate new DID keypair
 * 2. Store encrypted secret key
 * 3. Create wallet-DID mapping
 * 4. Register with backend
 * 5. Create session
 * 
 * Flow for existing users:
 * 1. Get DID from wallet mapping
 * 2. Decrypt and verify secret key with password
 * 3. Create session
 * 
 * @param walletAddress - Connected wallet address
 * @param password - User's password for key encryption/decryption
 * @param signMessage - Function to sign a message with the wallet
 */
export async function authenticateUser(
  walletAddress: string,
  password: string,
  signMessage?: (message: string) => Promise<string>
): Promise<AuthResult> {
  const normalizedAddress = walletAddress.toLowerCase();
  const existingDid = getDIDForWallet(normalizedAddress);
  
  if (existingDid) {
    // Existing user - verify password and restore session
    const secretKey = await retrieveSecretKey(existingDid, password);
    
    if (!secretKey) {
      throw new AuthError('AUTH_INVALID_PASSWORD', 'Invalid password');
    }
    
    try {
      // Restore DID info from secret key
      const { publicKey } = await restoreDIDFromSecretKey(secretKey);
      
      // Derive X25519 encryption public key from the Ed25519 secret key
      const encryptionPublicKey = getEncryptionPublicKey(secretKey);
    
      // Create session with expiration
      setSession(createSession(existingDid, normalizedAddress));
    
      return {
        did: existingDid,
        publicKey,
        encryptionPublicKey,
        isNewUser: false,
      };
    } finally {
      // Clear secret key from memory immediately after use
      secretKey.fill(0);
    }
  }
  
  // New user - generate DID and store
  const { did, publicKey, secretKey } = await generateDIDKeyPair();
  
  try {
    // Derive X25519 encryption public key from the Ed25519 secret key
    const encryptionPublicKey = getEncryptionPublicKey(secretKey);
    
    // Store encrypted secret key
    await storeSecretKey(secretKey, password, did);
  
    // Store wallet-DID mapping
    setDIDForWallet(normalizedAddress, did);
  
    // Request wallet signature to link wallet to DID
    if (signMessage) {
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = generateNonce(); // Prevent replay attacks
      const challenge = createLinkingChallenge(normalizedAddress, did, timestamp, nonce);
    
      try {
        const signature = await signMessage(challenge);
      
        // Register with backend (include nonce for replay protection)
        await registerUserOnBackend({
          did,
          nonce,
          publicKey,
          walletAddress: normalizedAddress,
          signature,
          timestamp,
        });
      } catch (error) {
        // If registration fails, clean up local state
        await deleteSecretKey(did);
        clearDIDForWallet(normalizedAddress);
      
        if (error instanceof Error && error.message.includes('rejected')) {
          throw new AuthError('AUTH_SIGNATURE_REJECTED', 'Signature request was rejected');
        }
        throw error;
      }
    }
  
    // Create session with expiration
    setSession(createSession(did, normalizedAddress));
  
    return {
      did,
      publicKey,
      encryptionPublicKey,
      isNewUser: true,
    };
  } finally {
    // Clear secret key from memory immediately after use
    secretKey.fill(0);
  }
}

/**
 * Check if user exists for a wallet
 */
export async function userExistsForWallet(walletAddress: string): Promise<boolean> {
  const did = getDIDForWallet(walletAddress.toLowerCase());
  if (!did) return false;
  
  return hasSecretKey(did);
}

/**
 * Unlock the secret key for operations (requires password)
 * Use this for operations that need the secret key (encryption, signing)
 * 
 * SECURITY: Caller MUST clear the returned key after use with secretKey.fill(0)
 * 
 * @param password - User's password
 * @returns The decrypted secret key bytes
 */
export async function unlockSecretKey(password: string): Promise<Uint8Array> {
  const session = getSession();
  if (!session) {
    throw new AuthError('AUTH_NO_SESSION', 'No active session');
  }
  
  const secretKey = await retrieveSecretKey(session.did, password);
  if (!secretKey) {
    throw new AuthError('AUTH_INVALID_PASSWORD', 'Invalid password');
  }
  
  return secretKey;
}

/**
 * Verify password without unlocking the key
 */
export async function checkPassword(password: string): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  
  return verifyPassword(session.did, password);
}

/**
 * Sign out and clear session
 * Does NOT delete the stored key - user can sign back in with password
 */
export function signOut(): void {
  clearSession();
}

/**
 * Completely remove user from this device
 * Deletes stored key - user would need to re-register
 */
export async function removeUserFromDevice(): Promise<void> {
  const session = getSession();
  if (!session) return;
  
  // Delete stored key
  await deleteSecretKey(session.did);
  
  // Clear wallet-DID mapping
  clearDIDForWallet(session.walletAddress);
  
  // Clear session
  clearSession();
}

/**
 * Register user on backend
 */
async function registerUserOnBackend(params: {
  did: string;
  publicKey: string;
  walletAddress: string;
  signature?: string;
  timestamp?: number;
  nonce?: string;
}): Promise<void> {
  const apiUrl = getApiUrl();
  
  const response = await fetch(`${apiUrl}/api/users/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Registration failed' }));
    throw new AuthError('AUTH_REGISTRATION_FAILED', error.message || 'Registration failed');
  }
}

/**
 * Custom authentication error
 */
export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Auth error codes
 */
export const AUTH_ERROR_CODES = {
  AUTH_INVALID_PASSWORD: 'AUTH_INVALID_PASSWORD',
  AUTH_NO_SESSION: 'AUTH_NO_SESSION',
  AUTH_SIGNATURE_REJECTED: 'AUTH_SIGNATURE_REJECTED',
  AUTH_REGISTRATION_FAILED: 'AUTH_REGISTRATION_FAILED',
  AUTH_WALLET_NOT_CONNECTED: 'AUTH_WALLET_NOT_CONNECTED',
} as const;

