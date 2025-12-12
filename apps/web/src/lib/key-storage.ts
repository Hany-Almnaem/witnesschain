/**
 * Secure Key Storage Module
 * 
 * Implements secure key storage using IndexedDB + Web Crypto API.
 * Keys are encrypted at rest using a password-derived key (PBKDF2).
 * 
 * Security principles:
 * - Keys are NEVER stored in plaintext
 * - Keys are NEVER stored in localStorage
 * - Password-derived key uses PBKDF2 with 100,000 iterations
 * - AES-GCM encryption for secret key storage
 * - Salt and IV are unique per encryption
 * - Rate limiting protects against brute-force attacks
 */

import type { EncryptedKeyRecord } from '@witnesschain/shared';

const DB_NAME = 'witnesschain-keys';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted-keys';

// PBKDF2 configuration (OWASP recommended minimum)
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/** Maximum failed attempts before lockout */
const MAX_FAILED_ATTEMPTS = 5;

/** Base lockout duration in milliseconds (1 minute) */
const BASE_LOCKOUT_MS = 60_000;

/** Maximum lockout duration in milliseconds (1 hour) */
const MAX_LOCKOUT_MS = 60 * 60 * 1000;

/**
 * Rate limiting state per DID
 * Stored in memory - resets on page reload (acceptable for client-side rate limiting)
 */
interface RateLimitState {
  failedAttempts: number;
  lockedUntil: number;
  lastAttempt: number;
}

const rateLimitState = new Map<string, RateLimitState>();

/**
 * Custom error for rate limiting
 */
export class RateLimitError extends Error {
  constructor(
    public readonly remainingSeconds: number
  ) {
    super(`Too many failed attempts. Please wait ${remainingSeconds} seconds before trying again.`);
    this.name = 'RateLimitError';
  }
}

/**
 * Check if a DID is currently rate limited
 * @returns remaining lockout time in seconds, or 0 if not locked
 */
export function getRateLimitStatus(did: string): number {
  const state = rateLimitState.get(did);
  if (!state) return 0;
  
  const now = Date.now();
  if (now >= state.lockedUntil) {
    return 0;
  }
  
  return Math.ceil((state.lockedUntil - now) / 1000);
}

/**
 * Check rate limit before password attempt
 * @throws RateLimitError if currently locked out
 */
function checkRateLimit(did: string): void {
  const remainingSeconds = getRateLimitStatus(did);
  if (remainingSeconds > 0) {
    throw new RateLimitError(remainingSeconds);
  }
}

/**
 * Record a failed password attempt
 * Implements exponential backoff for lockout duration
 */
function recordFailedAttempt(did: string): void {
  const now = Date.now();
  const state = rateLimitState.get(did) ?? {
    failedAttempts: 0,
    lockedUntil: 0,
    lastAttempt: 0,
  };
  
  state.failedAttempts++;
  state.lastAttempt = now;
  
  // Apply lockout after exceeding max attempts
  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    // Exponential backoff: 1min, 2min, 4min, 8min, ... up to 1 hour
    const backoffMultiplier = Math.pow(2, state.failedAttempts - MAX_FAILED_ATTEMPTS);
    const lockoutDuration = Math.min(BASE_LOCKOUT_MS * backoffMultiplier, MAX_LOCKOUT_MS);
    state.lockedUntil = now + lockoutDuration;
  }
  
  rateLimitState.set(did, state);
}

/**
 * Clear rate limit state after successful authentication
 */
function clearRateLimitState(did: string): void {
  rateLimitState.delete(did);
}

/**
 * Clear all rate limit state (for testing only)
 * WARNING: Do not use in production code
 */
export function clearAllRateLimitState(): void {
  rateLimitState.clear();
}

/**
 * Open IndexedDB connection
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open key storage database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'did' });
      }
    };
  });
}

/**
 * Derive encryption key from password using PBKDF2
 * This is CPU-intensive by design to resist brute-force attacks
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key from password
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Store a secret key encrypted with a password
 * 
 * @param secretKey - The secret key bytes to store
 * @param password - User's password for encryption
 * @param did - The DID identifier for this key
 */
export async function storeSecretKey(
  secretKey: Uint8Array,
  password: string,
  did: string
): Promise<void> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive encryption key from password
  const derivedKey = await deriveKeyFromPassword(password, salt);

  // Encrypt the secret key
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    derivedKey,
    secretKey.buffer as ArrayBuffer
  );

  // Prepare record for storage
  const record: EncryptedKeyRecord = {
    did,
    salt: Array.from(salt),
    iv: Array.from(iv),
    encryptedKey: Array.from(new Uint8Array(encryptedKey)),
    createdAt: Date.now(),
  };

  // Store in IndexedDB
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onerror = () => {
      reject(new Error('Failed to store encrypted key'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Retrieve and decrypt a secret key
 * 
 * @param did - The DID identifier for the key
 * @param password - User's password for decryption
 * @returns The decrypted secret key bytes, or null if not found or wrong password
 * @throws RateLimitError if too many failed attempts
 */
export async function retrieveSecretKey(
  did: string,
  password: string
): Promise<Uint8Array | null> {
  // Check rate limit before attempting decryption
  checkRateLimit(did);
  
  const db = await openDatabase();

  // Get encrypted record from IndexedDB
  const record = await new Promise<EncryptedKeyRecord | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(did);

    request.onerror = () => {
      reject(new Error('Failed to retrieve key record'));
    };

    request.onsuccess = () => {
      resolve(request.result as EncryptedKeyRecord | undefined);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });

  if (!record) {
    return null;
  }

  try {
    // Convert arrays back to Uint8Arrays
    const salt = new Uint8Array(record.salt);
    const iv = new Uint8Array(record.iv);
    const encryptedKey = new Uint8Array(record.encryptedKey);

    // Derive decryption key from password
    const derivedKey = await deriveKeyFromPassword(password, salt);

    // Decrypt the secret key
    const decryptedKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      derivedKey,
      encryptedKey.buffer as ArrayBuffer
    );

    // Success - clear rate limit state
    clearRateLimitState(did);
    
    return new Uint8Array(decryptedKey);
  } catch {
    // Decryption failed - wrong password or corrupted data
    recordFailedAttempt(did);
    return null;
  }
}

/**
 * Check if a key exists for a given DID
 * Does NOT require password - only checks existence
 */
export async function hasSecretKey(did: string): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(did);

    request.onerror = () => {
      reject(new Error('Failed to check key existence'));
    };

    request.onsuccess = () => {
      resolve(!!request.result);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Delete a stored key (for logout or key rotation)
 */
export async function deleteSecretKey(did: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(did);

    request.onerror = () => {
      reject(new Error('Failed to delete key'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * List all stored DIDs (for account selection)
 * Does NOT return actual keys
 */
export async function listStoredDids(): Promise<string[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onerror = () => {
      reject(new Error('Failed to list stored DIDs'));
    };

    request.onsuccess = () => {
      resolve(request.result as string[]);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Get key metadata without decrypting
 * Useful for displaying when the key was created
 */
export async function getKeyMetadata(
  did: string
): Promise<{ createdAt: number } | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(did);

    request.onerror = () => {
      reject(new Error('Failed to get key metadata'));
    };

    request.onsuccess = () => {
      const record = request.result as EncryptedKeyRecord | undefined;
      if (record) {
        resolve({ createdAt: record.createdAt });
      } else {
        resolve(null);
      }
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Clear all stored keys (for complete logout/reset)
 * USE WITH CAUTION - this is irreversible
 */
export async function clearAllKeys(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => {
      reject(new Error('Failed to clear keys'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Verify password correctness without returning the key
 * Useful for password confirmation dialogs
 */
export async function verifyPassword(
  did: string,
  password: string
): Promise<boolean> {
  const key = await retrieveSecretKey(did, password);
  if (key) {
    // Clear key from memory immediately - we only needed to verify password
    key.fill(0);
    return true;
  }
  return false;
}

