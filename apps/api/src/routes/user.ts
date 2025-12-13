/**
 * User Routes
 * 
 * Handles user registration and profile management.
 * Users are identified by DIDs (did:key format).
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { verifyMessage } from 'viem';

import { db, users, type NewUser } from '../db/index.js';
import { Errors } from '../middleware/error.js';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { 
  createLinkingChallenge, 
  isValidSignatureTimestamp 
} from '@witnesschain/shared';

export const userRoutes = new Hono();

// ============================================================================
// Nonce Store for Replay Attack Prevention
// ============================================================================

/**
 * In-memory nonce store with TTL cleanup
 * In production, consider using Redis with TTL for distributed systems
 */
interface NonceEntry {
  usedAt: number;
}

const usedNonces = new Map<string, NonceEntry>();
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes (2x signature max age)

/**
 * Clean up expired nonces periodically
 */
function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, entry] of usedNonces.entries()) {
    if (now - entry.usedAt > NONCE_TTL_MS) {
      usedNonces.delete(nonce);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredNonces, 5 * 60 * 1000);

/**
 * Check if nonce has been used and mark it as used
 * @returns true if nonce was already used (replay attack), false if new
 */
function checkAndMarkNonce(nonce: string): boolean {
  if (usedNonces.has(nonce)) {
    return true; // Already used - replay attack
  }
  usedNonces.set(nonce, { usedAt: Date.now() });
  return false; // New nonce - OK
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * User registration schema
 */
const registerSchema = z.object({
  did: z
    .string()
    .min(1, 'DID is required')
    .regex(/^did:key:z[a-zA-Z0-9]+$/, 'Invalid DID format'),
  publicKey: z.string().min(1, 'Public key is required'),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')
    .optional()
    .transform(val => val?.toLowerCase()),
  signature: z.string().optional(),
  timestamp: z.number().optional(),
  nonce: z.string().min(16).max(64).optional(), // UUID or hex string
});

/**
 * User profile update schema
 */
const updateProfileSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')
    .optional()
    .transform(val => val?.toLowerCase()),
});

/**
 * Register a new user
 * POST /api/users/register
 */
userRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { did, publicKey, walletAddress, signature, timestamp, nonce } = c.req.valid('json');

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, did),
  });

  if (existingUser) {
    // User exists - return existing user info
    return c.json(
      {
        success: true,
        data: {
          id: existingUser.id,
          publicKey: existingUser.publicKey,
          walletAddress: existingUser.walletAddress,
          createdAt: existingUser.createdAt,
          isExisting: true,
        },
      },
      200
    );
  }

  // Validate signature if provided (for linking wallet to DID)
  if (signature && timestamp && walletAddress) {
    // Validate timestamp is within acceptable range
    if (!isValidSignatureTimestamp(timestamp)) {
      throw Errors.badRequest('Signature timestamp expired or invalid');
    }
    
    // Validate nonce is provided and not already used (replay attack prevention)
    if (!nonce) {
      throw Errors.badRequest('Nonce is required for wallet registration');
    }
    
    if (checkAndMarkNonce(nonce)) {
      throw Errors.badRequest('Nonce already used - possible replay attack');
    }
    
    // Reconstruct the expected message that was signed (include nonce)
    const expectedMessage = createLinkingChallenge(walletAddress, did, timestamp, nonce);
    
    // Verify the signature matches the wallet address
    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message: expectedMessage,
        signature: signature as `0x${string}`,
      });
      
      if (!isValid) {
        throw Errors.unauthorized('Invalid wallet signature');
      }
    } catch (error) {
      // verifyMessage throws if signature format is invalid
      if (error instanceof Error && error.message.includes('Invalid wallet signature')) {
        throw error;
      }
      throw Errors.badRequest('Invalid signature format');
    }
  } else if (walletAddress) {
    // If wallet address is provided without signature, reject
    // This prevents registration of arbitrary wallet addresses
    throw Errors.badRequest('Wallet registration requires signature verification');
  }

  // Create new user
  const newUser: NewUser = {
    id: did,
    publicKey,
    walletAddress: walletAddress ?? null,
  };

  try {
    await db.insert(users).values(newUser);

    return c.json(
      {
        success: true,
        data: {
          id: did,
          publicKey,
          walletAddress: walletAddress ?? null,
          createdAt: new Date().toISOString(),
          isExisting: false,
        },
      },
      201
    );
  } catch (error) {
    console.error('[User Registration] Failed:', error);
    throw Errors.internalError();
  }
});

/**
 * Get current user profile
 * GET /api/users/me
 * Requires authenticated request with wallet signature
 * 
 * NOTE: This route MUST be registered before /:did to avoid being caught by the param route
 */
userRoutes.get('/me', requireAuth, async (c) => {
  const authUser = getAuthUser(c);

  const user = await db.query.users.findFirst({
    where: eq(users.id, authUser.did),
  });

  if (!user) {
    throw Errors.notFound('User not found');
  }

  return c.json({
    success: true,
    data: {
      id: user.id,
      publicKey: user.publicKey,
      walletAddress: user.walletAddress,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

/**
 * Get user by DID
 * GET /api/users/:did
 * 
 * NOTE: This parameterized route MUST be registered AFTER more specific routes
 * like /me and /wallet/:address, otherwise it will catch those requests first.
 */
userRoutes.get('/:did', async (c) => {
  const did = c.req.param('did');

  // Validate DID format
  if (!did.startsWith('did:key:z')) {
    throw Errors.badRequest('Invalid DID format');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, did),
  });

  if (!user) {
    throw Errors.notFound('User not found');
  }

  return c.json({
    success: true,
    data: {
      id: user.id,
      publicKey: user.publicKey,
      walletAddress: user.walletAddress,
      createdAt: user.createdAt,
    },
  });
});

/**
 * Update user profile
 * PATCH /api/users/me
 * Requires authenticated request with wallet signature
 */
userRoutes.patch('/me', requireAuth, zValidator('json', updateProfileSchema), async (c) => {
  const authUser = getAuthUser(c);
  const { walletAddress } = c.req.valid('json');

  // Check user exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, authUser.did),
  });

  if (!user) {
    throw Errors.notFound('User not found');
  }

  // Create single timestamp for consistency between DB and response
  const updatedAt = new Date();

  // Update user
  await db
    .update(users)
    .set({
      walletAddress: walletAddress ?? user.walletAddress,
      updatedAt,
    })
    .where(eq(users.id, authUser.did));

  return c.json({
    success: true,
    data: {
      id: user.id,
      publicKey: user.publicKey,
      walletAddress: walletAddress ?? user.walletAddress,
      updatedAt: updatedAt.toISOString(),
    },
  });
});

/**
 * Check if user exists by wallet address
 * GET /api/users/wallet/:address
 */
userRoutes.get('/wallet/:address', async (c) => {
  const address = c.req.param('address').toLowerCase();

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw Errors.badRequest('Invalid wallet address format');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.walletAddress, address),
  });

  if (!user) {
    return c.json({
      success: true,
      data: {
        exists: false,
      },
    });
  }

  return c.json({
    success: true,
    data: {
      exists: true,
      did: user.id,
    },
  });
});

/**
 * Delete user (for testing/development only)
 * DELETE /api/users/:did
 * Only available in development mode
 * Requires authenticated request with wallet signature
 */
userRoutes.delete('/:did', requireAuth, async (c) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    throw Errors.forbidden('Not available in production');
  }

  const did = c.req.param('did');
  const authUser = getAuthUser(c);

  // Must be authenticated as the same user
  if (authUser.did !== did) {
    throw Errors.forbidden('Can only delete your own account');
  }

  await db.delete(users).where(eq(users.id, did));

  return c.json({
    success: true,
    message: 'User deleted',
  });
});
