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
import { v4 as uuid } from 'uuid';

import { db, users, type NewUser } from '../db/index.js';
import { Errors } from '../middleware/error.js';

export const userRoutes = new Hono();

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
  const { did, publicKey, walletAddress, signature, timestamp } = c.req.valid('json');

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
    // In production, verify the signature matches the expected message
    // For MVP, we trust the client-side signature verification
    const timestampAge = Math.floor(Date.now() / 1000) - timestamp;
    if (timestampAge > 300) { // 5 minute max age
      throw Errors.badRequest('Signature timestamp expired');
    }
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
 * Requires authentication (X-DID header)
 * 
 * NOTE: This route MUST be registered before /:did to avoid being caught by the param route
 */
userRoutes.get('/me', async (c) => {
  const did = c.req.header('X-DID');

  if (!did) {
    throw Errors.unauthorized('Authentication required');
  }

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
 * Requires authentication (X-DID header)
 */
userRoutes.patch('/me', zValidator('json', updateProfileSchema), async (c) => {
  const did = c.req.header('X-DID');

  if (!did) {
    throw Errors.unauthorized('Authentication required');
  }

  const { walletAddress } = c.req.valid('json');

  // Check user exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, did),
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
    .where(eq(users.id, did));

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
 */
userRoutes.delete('/:did', async (c) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    throw Errors.forbidden('Not available in production');
  }

  const did = c.req.param('did');
  const authDid = c.req.header('X-DID');

  // Must be authenticated as the same user
  if (authDid !== did) {
    throw Errors.forbidden('Can only delete your own account');
  }

  await db.delete(users).where(eq(users.id, did));

  return c.json({
    success: true,
    message: 'User deleted',
  });
});
