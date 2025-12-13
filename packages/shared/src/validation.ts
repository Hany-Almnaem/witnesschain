/**
 * WitnessChain Validation Schemas
 * Zod schemas for runtime validation across frontend and backend
 */

import { z } from 'zod';

import {
  ALLOWED_FILE_TYPES,
  EVIDENCE_CATEGORIES,
  SOURCE_TYPES,
  CONTENT_WARNINGS,
  EVIDENCE_STATUS,
  VERIFICATION_STATUS,
  FILE_SIZE_LIMITS,
} from './constants.js';

/**
 * File validation schema
 */
export const fileValidationSchema = z.object({
  name: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name too long'),
  size: z
    .number()
    .min(FILE_SIZE_LIMITS.MIN_BYTES, 'File must be at least 127 bytes')
    .max(FILE_SIZE_LIMITS.MAX_BYTES, 'File must be less than 200MB'),
  type: z.enum(ALLOWED_FILE_TYPES, {
    errorMap: () => ({ message: 'File type not supported' }),
  }),
});

/**
 * Evidence location schema
 */
export const locationSchema = z.object({
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Evidence date schema
 */
export const dateSchema = z.object({
  occurred: z.string().datetime().optional(),
  approximate: z.string().max(100).optional(),
});

/**
 * Evidence source schema
 */
export const sourceSchema = z.object({
  type: z.enum(SOURCE_TYPES),
  name: z.string().max(200).optional(),
});

/**
 * Evidence metadata schema
 */
export const evidenceMetadataSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be less than 200 characters')
    .regex(/^[^<>{}]*$/, 'Title contains invalid characters'),

  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be less than 5000 characters')
    .optional(),

  category: z.enum(EVIDENCE_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),

  location: locationSchema.optional(),

  date: dateSchema.optional(),

  source: sourceSchema,

  contentWarnings: z.array(z.enum(CONTENT_WARNINGS)).optional(),

  tags: z.array(z.string().max(50)).max(10).optional(),
});

/**
 * Encryption info schema
 */
export const encryptionInfoSchema = z.object({
  encryptedKey: z.string().min(1, 'Encrypted key is required'),
  nonce: z.string().min(1, 'Nonce is required'),
  contentHash: z.string().regex(/^0x[a-f0-9]{64}$/, 'Invalid content hash'),
});

/**
 * Full upload request schema
 */
export const uploadRequestSchema = z.object({
  file: fileValidationSchema,
  metadata: evidenceMetadataSchema,
  encryption: encryptionInfoSchema,
});

/**
 * User registration schema
 */
export const userRegistrationSchema = z.object({
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
 * Evidence status schema
 */
export const evidenceStatusSchema = z.enum(EVIDENCE_STATUS);

/**
 * Verification status schema
 */
export const verificationStatusSchema = z.enum(VERIFICATION_STATUS);

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * Content hash schema
 */
export const contentHashSchema = z
  .string()
  .regex(/^0x[a-f0-9]{64}$/, 'Invalid content hash');

/**
 * Ethereum address schema
 */
export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

/**
 * Transaction hash schema
 */
export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash');

/**
 * DID schema
 */
export const didSchema = z
  .string()
  .regex(/^did:key:z[a-zA-Z0-9]+$/, 'Invalid DID format');

// Type exports
export type FileValidation = z.infer<typeof fileValidationSchema>;
export type EvidenceMetadata = z.infer<typeof evidenceMetadataSchema>;
export type EncryptionInfo = z.infer<typeof encryptionInfoSchema>;
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Validate evidence before upload
 */
export function validateEvidence(data: unknown): {
  success: boolean;
  data?: UploadRequest;
  errors?: z.ZodError['errors'];
} {
  const result = uploadRequestSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error.errors };
}

/**
 * Validate user registration data
 */
export function validateUserRegistration(data: unknown): {
  success: boolean;
  data?: UserRegistration;
  errors?: z.ZodError['errors'];
} {
  const result = userRegistrationSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error.errors };
}

/**
 * Sanitize text input (remove potential XSS)
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Check if a file type is allowed
 */
export function isAllowedFileType(type: string): type is typeof ALLOWED_FILE_TYPES[number] {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(type);
}

/**
 * Get human-readable file size limit
 */
export function getFileSizeLimitString(): string {
  return `${FILE_SIZE_LIMITS.MAX_BYTES / (1024 * 1024)}MB`;
}

// ============================================================================
// Authentication Utilities
// ============================================================================

/**
 * Maximum age for signature timestamps (5 minutes)
 */
export const SIGNATURE_MAX_AGE_SECONDS = 300;

/**
 * Generate a cryptographically secure nonce
 * Uses crypto.randomUUID() when available, falls back to random hex string
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without randomUUID
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a challenge message for wallet signature
 * This links the wallet address to the DID
 * 
 * IMPORTANT: This function must be deterministic and identical on client and server
 * 
 * @param walletAddress - The wallet address (will be normalized to lowercase)
 * @param did - The DID to link
 * @param timestamp - Unix timestamp in seconds
 * @param nonce - Unique nonce to prevent replay attacks
 * @returns Challenge message string
 */
export function createLinkingChallenge(
  walletAddress: string,
  did: string,
  timestamp: number,
  nonce?: string
): string {
  const normalizedAddress = walletAddress.toLowerCase();
  
  const lines = [
    'WitnessChain Identity Verification',
    '',
    'This signature links your wallet to your WitnessChain identity.',
    '',
    `Wallet: ${normalizedAddress}`,
    `Identity: ${did}`,
    `Timestamp: ${timestamp}`,
  ];
  
  // Add nonce if provided (for replay protection)
  if (nonce) {
    lines.push(`Nonce: ${nonce}`);
  }
  
  lines.push('');
  lines.push('This request will not trigger a blockchain transaction or cost any gas fees.');
  
  return lines.join('\n');
}

/**
 * Validate signature timestamp is within acceptable range
 * 
 * @param timestamp - Unix timestamp in seconds
 * @returns True if timestamp is valid (not too old or in future)
 */
export function isValidSignatureTimestamp(timestamp: number): boolean {
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
 * Create a message for authenticated API requests
 * This message is signed by the wallet to prove ownership of the DID
 * 
 * IMPORTANT: Must match server-side implementation exactly
 * 
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Request path (e.g., /api/users/me)
 * @param timestamp - Unix timestamp in seconds
 * @param did - The DID making the request
 * @returns Message string to be signed
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

// ============================================================================
// Password Validation
// ============================================================================

/** Password strength levels */
export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

/** Password validation result */
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  score: number;
  errors: string[];
  suggestions: string[];
}

/** Minimum requirements for password acceptance */
export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 12, // Increased from 8 for better security
  MIN_STRENGTH: 'fair' as PasswordStrength,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: false, // Recommended but not required
} as const;

/**
 * Validate password strength and requirements
 * Returns detailed validation result with errors and suggestions
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;
  
  // Length checks
  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.MIN_LENGTH} characters`);
  } else {
    score += 1;
  }
  
  if (password.length >= 16) {
    score += 1;
    suggestions.push('Great length!');
  } else {
    suggestions.push('Consider using 16+ characters for extra security');
  }
  
  // Character class checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  if (PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (hasUppercase) {
    score += 1;
  }
  
  if (PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (hasLowercase) {
    score += 1;
  }
  
  if (PASSWORD_REQUIREMENTS.REQUIRE_NUMBER && !hasNumber) {
    errors.push('Password must contain at least one number');
  } else if (hasNumber) {
    score += 1;
  }
  
  if (hasSpecial) {
    score += 1;
    suggestions.push('Good use of special characters!');
  } else if (PASSWORD_REQUIREMENTS.REQUIRE_SPECIAL) {
    errors.push('Password must contain at least one special character');
  } else {
    suggestions.push('Adding special characters would improve strength');
  }
  
  // Common password patterns to avoid
  const commonPatterns = [
    /^(.)\1+$/, // All same character
    /^(012|123|234|345|456|567|678|789|890)+$/i, // Sequential numbers
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // Sequential letters
    /password/i,
    /witness/i,
    /chain/i,
    /^qwerty/i,
    /^asdfgh/i,
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common patterns that are easy to guess');
      score = Math.max(0, score - 2);
      break;
    }
  }
  
  // Calculate strength
  let strength: PasswordStrength;
  if (score <= 2) {
    strength = 'weak';
  } else if (score <= 3) {
    strength = 'fair';
  } else if (score <= 4) {
    strength = 'good';
  } else {
    strength = 'strong';
  }
  
  // Check minimum strength requirement
  const strengthOrder: PasswordStrength[] = ['weak', 'fair', 'good', 'strong'];
  const minStrengthIndex = strengthOrder.indexOf(PASSWORD_REQUIREMENTS.MIN_STRENGTH);
  const currentStrengthIndex = strengthOrder.indexOf(strength);
  
  if (currentStrengthIndex < minStrengthIndex) {
    errors.push(`Password strength must be at least "${PASSWORD_REQUIREMENTS.MIN_STRENGTH}"`);
  }
  
  return {
    isValid: errors.length === 0,
    strength,
    score,
    errors,
    suggestions: errors.length === 0 ? suggestions : [],
  };
}

/** Zod schema for password validation */
export const passwordSchema = z
  .string()
  .min(PASSWORD_REQUIREMENTS.MIN_LENGTH, 
    `Password must be at least ${PASSWORD_REQUIREMENTS.MIN_LENGTH} characters`)
  .refine(
    (password) => validatePassword(password).isValid,
    (password) => ({
      message: validatePassword(password).errors.join('. '),
    })
  );
