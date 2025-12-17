/**
 * Authentication Middleware
 * 
 * Verifies that API requests are properly authenticated.
 * Uses wallet signatures to prove ownership of the DID.
 * 
 * Required headers for authenticated requests:
 * - X-DID: The DID making the request
 * - X-Wallet-Address: The wallet address linked to the DID
 * - X-Timestamp: Unix timestamp (seconds)
 * - X-Signature: Wallet signature of the request
 */

import { eq } from 'drizzle-orm';
import { verifyMessage } from 'viem';

import { Errors } from './error.js';
import { db, users } from '../db/index.js';

import type { Context, Next } from 'hono';

/**
 * Maximum age for request signatures (5 minutes)
 */
const SIGNATURE_MAX_AGE_SECONDS = 300;

/**
 * Create the message to be signed for authenticated requests
 * Must match the client-side implementation exactly
 */
export function createAuthMessage(
  method: string,
  path: string,
  timestamp: number,
  did: string
): string {
  return [
    'WitnessChain API Request',
    '',
    `Method: ${method}`,
    `Path: ${path}`,
    `Timestamp: ${timestamp}`,
    `Identity: ${did}`,
    '',
    'This signature authorizes this API request.',
  ].join('\n');
}

/**
 * Verify request timestamp is within acceptable range
 */
function isValidTimestamp(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;
  
  // Reject if too old
  if (age > SIGNATURE_MAX_AGE_SECONDS) {
    return false;
  }
  
  // Reject if too far in the future (clock skew tolerance: 60 seconds)
  if (age < -60) {
    return false;
  }
  
  return true;
}

/**
 * Authentication middleware for protected routes
 * 
 * Supports two auth modes:
 * 1. Session-based (MVP): X-DID + X-Wallet-Address headers, validated against DB
 * 2. Signature-based (full): All headers + cryptographic signature verification
 * 
 * TODO: For production, enforce signature-based auth for sensitive operations
 */
export async function requireAuth(c: Context, next: Next) {
  const did = c.req.header('X-DID');
  const walletAddress = c.req.header('X-Wallet-Address')?.toLowerCase();
  const timestampStr = c.req.header('X-Timestamp');
  const signature = c.req.header('X-Signature');

  // Check required headers (DID and wallet always required)
  if (!did) {
    throw Errors.unauthorized('Missing X-DID header');
  }

  if (!walletAddress) {
    throw Errors.unauthorized('Missing X-Wallet-Address header');
  }

  // Validate DID format
  if (!did.startsWith('did:key:z')) {
    throw Errors.badRequest('Invalid DID format');
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw Errors.badRequest('Invalid wallet address format');
  }

  // Verify wallet is linked to DID in database
  const user = await db.query.users.findFirst({
    where: eq(users.id, did),
  });

  if (!user) {
    throw Errors.notFound('User not found');
  }

  if (user.walletAddress !== walletAddress) {
    throw Errors.unauthorized('Wallet address does not match DID');
  }

  // MVP: Session-based auth - if DID and wallet match database, allow request
  // For production: Always require signature verification
  const useSignatureAuth = timestampStr && signature;
  
  if (useSignatureAuth) {
    // Full signature-based auth
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      throw Errors.badRequest('Invalid timestamp format');
    }

    if (!isValidTimestamp(timestamp)) {
      throw Errors.unauthorized('Request timestamp expired');
    }

    // Reconstruct the expected message
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const expectedMessage = createAuthMessage(method, path, timestamp, did);

    // Verify signature
    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message: expectedMessage,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        throw Errors.unauthorized('Invalid signature');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid signature')) {
        throw error;
      }
      throw Errors.badRequest('Invalid signature format');
    }
  }
  // else: Session-based auth - DID and wallet already validated against DB above

  // Store authenticated user info in context
  c.set('user', {
    did,
    walletAddress,
    publicKey: user.publicKey,
  });

  await next();
}

/**
 * Authenticated user type
 */
interface AuthenticatedUser {
  did: string;
  walletAddress: string;
  publicKey: string;
}

/**
 * Get authenticated user from context
 * Only available after requireAuth middleware
 */
export function getAuthUser(c: Context): AuthenticatedUser {
  const user = c.get('user') as AuthenticatedUser | undefined;
  if (!user) {
    throw Errors.unauthorized('Not authenticated');
  }
  return user;
}

