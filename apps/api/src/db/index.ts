import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema.js';

// Database client singleton
let dbClient: ReturnType<typeof createClient> | null = null;

/**
 * Get or create the database client
 * Uses libsql for local development (SQLite) and Turso for production
 */
function getClient() {
  if (dbClient) {
    return dbClient;
  }

  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  dbClient = createClient({
    url,
    authToken,
  });

  return dbClient;
}

/**
 * Database instance with schema
 */
export const db = drizzle(getClient(), { schema });

/**
 * Check if database is connected
 */
export async function isDatabaseConnected(): Promise<boolean> {
  try {
    const client = getClient();
    await client.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('[Database] Connection check failed:', error);
    return false;
  }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbClient) {
    dbClient.close();
    dbClient = null;
  }
}

// Re-export schema for convenience
export * from './schema.js';
