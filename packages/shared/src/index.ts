/**
 * @witnesschain/shared
 * Shared types, constants, utilities, validation, and error handling
 */

// Re-export constants
export * from './constants.js';

// Re-export types (core type definitions)
export type {
  AllowedFileType,
  EvidenceCategory,
  SourceType,
  ContentWarning,
  EvidenceStatus,
  VerificationStatus,
  AccessLogAction,
  User,
  EvidenceLocation,
  EvidenceDate,
  EvidenceSource,
  Evidence,
  Verification,
  AccessLog,
  FilecoinStorageResult,
  FvmTransactionResult,
  Session,
  EncryptedKeyRecord,
  ApiErrorResponse,
  ApiResponse,
  HealthCheckResponse,
} from './types/index.js';

// Re-export config
export * from './config.js';

// Re-export errors
export * from './errors.js';

// Re-export validation (schemas and utilities)
export {
  fileValidationSchema,
  locationSchema,
  dateSchema,
  sourceSchema,
  evidenceMetadataSchema,
  encryptionInfoSchema,
  uploadRequestSchema,
  userRegistrationSchema,
  evidenceStatusSchema,
  verificationStatusSchema,
  paginationSchema,
  contentHashSchema,
  ethereumAddressSchema,
  txHashSchema,
  didSchema,
  validateEvidence,
  validateUserRegistration,
  sanitizeText,
  isAllowedFileType,
  getFileSizeLimitString,
  // Auth utilities
  createLinkingChallenge,
  createAuthMessage,
  isValidSignatureTimestamp,
  SIGNATURE_MAX_AGE_SECONDS,
} from './validation.js';

// Re-export validation types
export type {
  FileValidation,
  EvidenceMetadata,
  EncryptionInfo,
  UploadRequest,
  UserRegistration,
  Pagination,
} from './validation.js';
