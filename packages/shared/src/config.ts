/**
 * WitnessChain Environment Configuration
 * Validates and loads environment variables with Zod
 */

import { z } from 'zod';

/**
 * Backend environment schema
 * These variables are only available on the server
 */
export const backendEnvSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  CORS_ORIGIN: z.string().url().optional().default('http://localhost:3000'),

  // Filecoin / Synapse SDK
  FILECOIN_RPC_URL: z
    .string()
    .url('Invalid Filecoin RPC URL')
    .default('https://api.calibration.node.glif.io/rpc/v1'),
  FILECOIN_NETWORK: z.enum(['calibration', 'mainnet']).default('calibration'),

  // Backend wallet (for storage payments) - NEVER expose to frontend
  BACKEND_PRIVATE_KEY: z
    .string()
    .min(64, 'Invalid private key')
    .optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required').default('file:./dev.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(),

  // FVM Contract
  EVIDENCE_REGISTRY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address')
    .optional(),
});

/**
 * Frontend environment schema
 * These variables are exposed to the browser (NEXT_PUBLIC_ prefix)
 */
export const frontendEnvSchema = z.object({
  // Public Filecoin config
  NEXT_PUBLIC_FILECOIN_RPC_URL: z
    .string()
    .url('Invalid Filecoin RPC URL')
    .default('https://api.calibration.node.glif.io/rpc/v1'),
  NEXT_PUBLIC_FILECOIN_NETWORK: z.enum(['calibration', 'mainnet']).default('calibration'),
  NEXT_PUBLIC_CHAIN_ID: z.string().default('314159'), // Calibration testnet

  // API URL
  NEXT_PUBLIC_API_URL: z.string().url('Invalid API URL').default('http://localhost:3001'),

  // FVM Contract (public - for reading)
  NEXT_PUBLIC_EVIDENCE_REGISTRY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address')
    .optional(),

  // WalletConnect Project ID
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
});

// Type exports
export type BackendEnv = z.infer<typeof backendEnvSchema>;
export type FrontendEnv = z.infer<typeof frontendEnvSchema>;

/**
 * Validate and load backend environment
 * Call this at server startup to fail fast on missing config
 */
export function loadBackendEnv(): BackendEnv {
  const result = backendEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid backend environment configuration:');
    result.error.errors.forEach((err) => {
      console.error(`   ${err.path.join('.')}: ${err.message}`);
    });
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

/**
 * Validate frontend environment (at build time)
 * Next.js automatically exposes NEXT_PUBLIC_ variables to the client
 */
export function loadFrontendEnv(): FrontendEnv {
  const env = {
    NEXT_PUBLIC_FILECOIN_RPC_URL: process.env.NEXT_PUBLIC_FILECOIN_RPC_URL,
    NEXT_PUBLIC_FILECOIN_NETWORK: process.env.NEXT_PUBLIC_FILECOIN_NETWORK,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_EVIDENCE_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_EVIDENCE_REGISTRY_ADDRESS,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  };

  const result = frontendEnvSchema.safeParse(env);

  if (!result.success) {
    console.error('❌ Invalid frontend environment configuration:');
    result.error.errors.forEach((err) => {
      console.error(`   ${err.path.join('.')}: ${err.message}`);
    });
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

/**
 * Get the current environment
 */
export function getEnv(): 'development' | 'staging' | 'production' {
  return (process.env.NODE_ENV as 'development' | 'staging' | 'production') ?? 'development';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return getEnv() === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getEnv() === 'production';
}

/**
 * Get Filecoin chain ID for the current network
 */
export function getChainId(): number {
  const network = process.env.FILECOIN_NETWORK ?? process.env.NEXT_PUBLIC_FILECOIN_NETWORK;
  return network === 'mainnet' ? 314 : 314159;
}
