import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';

import { errorHandler } from './middleware/error.js';
import { healthRoutes } from './routes/health.js';
import { evidenceRoutes } from './routes/evidence.js';
import { userRoutes } from './routes/user.js';
import { verifyRoutes } from './routes/verify.js';

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  const { config } = await import('dotenv');
  config({ path: '../../.env' });
}

const app = new Hono();

// Security middleware
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-DID'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 3600,
    credentials: true,
  })
);

// Logging and timing middleware
app.use('*', logger());
app.use('*', timing());

// Error handling middleware
app.onError(errorHandler);

// Root route
app.get('/', (c) => {
  return c.json({
    name: 'WitnessChain API',
    version: '0.1.0',
    description: 'Decentralized Human Rights Evidence Platform API',
    docs: '/api/health',
  });
});

// API routes
app.route('/api/health', healthRoutes);
app.route('/api/users', userRoutes);
app.route('/api/evidence', evidenceRoutes);
app.route('/api/verify', verifyRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'NOT_FOUND',
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    },
    404
  );
});

// Start server
const port = parseInt(process.env.PORT ?? '3001', 10);

console.info(`
╔══════════════════════════════════════════════════════════════╗
║                     WitnessChain API                         ║
╠══════════════════════════════════════════════════════════════╣
║  Environment: ${(process.env.NODE_ENV ?? 'development').padEnd(44)}║
║  Port:        ${String(port).padEnd(44)}║
║  Network:     ${(process.env.FILECOIN_NETWORK ?? 'calibration').padEnd(44)}║
╚══════════════════════════════════════════════════════════════╝
`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
