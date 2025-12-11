import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

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
    .optional(),
});

/**
 * Register a new user
 * POST /api/users/register
 */
userRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { did, publicKey, walletAddress } = c.req.valid('json');

  // TODO: Implement user registration in Phase 2
  // For now, return a placeholder response
  
  return c.json(
    {
      success: true,
      data: {
        id: did,
        publicKey,
        walletAddress,
        createdAt: new Date().toISOString(),
      },
    },
    201
  );
});

/**
 * Get user by DID
 * GET /api/users/:did
 */
userRoutes.get('/:did', async (c) => {
  const did = c.req.param('did');

  // Validate DID format
  if (!did.startsWith('did:key:z')) {
    throw Errors.badRequest('Invalid DID format');
  }

  // TODO: Implement user lookup in Phase 2
  // For now, return a placeholder response
  
  return c.json({
    success: true,
    data: {
      id: did,
      publicKey: 'placeholder',
      createdAt: new Date().toISOString(),
    },
  });
});

/**
 * Get current user profile
 * GET /api/users/me
 * Requires authentication
 */
userRoutes.get('/me', async (c) => {
  const did = c.req.header('X-DID');

  if (!did) {
    throw Errors.unauthorized('Authentication required');
  }

  // TODO: Implement profile lookup in Phase 2
  
  return c.json({
    success: true,
    data: {
      id: did,
      publicKey: 'placeholder',
      createdAt: new Date().toISOString(),
    },
  });
});
