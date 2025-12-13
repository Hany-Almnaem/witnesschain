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

import type { Context, Next } from 'hono';
import { verifyMessage } from 'viem';
import { eq } from 'drizzle-orm';

import { db, users } from '../db/index.js';
import { Errors } from './error.js';

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
 * Verifies:
 * 1. DID format is valid
 * 2. Wallet address is linked to the DID in database
 * 3. Timestamp is fresh (not expired)
 * 4. Signature is valid (proves wallet ownership)
 */
export async function requireAuth(c: Context, next: Next) {
  const did = c.req.header('X-DID');
  const walletAddress = c.req.header('X-Wallet-Address')?.toLowerCase();
  const timestampStr = c.req.header('X-Timestamp');
  const signature = c.req.header('X-Signature');

  // Check required headers
  if (!did) {
    throw Errors.unauthorized('Missing X-DID header');
  }

  if (!walletAddress) {
    throw Errors.unauthorized('Missing X-Wallet-Address header');
  }

  if (!timestampStr) {
    throw Errors.unauthorized('Missing X-Timestamp header');
  }

  if (!signature) {
    throw Errors.unauthorized('Missing X-Signature header');
  }

  // Validate DID format
  if (!did.startsWith('did:key:z')) {
    throw Errors.badRequest('Invalid DID format');
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw Errors.badRequest('Invalid wallet address format');
  }

  // Parse and validate timestamp
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    throw Errors.badRequest('Invalid timestamp format');
  }

  if (!isValidTimestamp(timestamp)) {
    throw Errors.unauthorized('Request timestamp expired');
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

  // Store authenticated user info in context
  c.set('user', {
    did,
    walletAddress,
    publicKey: user.publicKey,
  });

  await next();
}

/**
 * Get authenticated user from context
 * Only available after requireAuth middleware
 */
export function getAuthUser(c: Context): {
  did: string;
  walletAddress: string;
  publicKey: string;
} {
  const user = c.get('user');
  if (!user) {
    throw Errors.unauthorized('Not authenticated');
  }
  return user;
}

