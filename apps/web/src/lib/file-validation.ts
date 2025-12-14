/**
 * File Validation Module
 *
 * Client-side validation for evidence file uploads.
 * Extends shared validation with browser-specific utilities.
 *
 * Validation checks:
 * - File type (MIME type whitelist)
 * - File size (min/max limits)
 * - File extension verification
 * - Magic bytes verification (for common file types)
 */

import {
  ALLOWED_FILE_TYPES,
  FILE_SIZE_LIMITS,
  isAllowedFileType,
  getFileSizeLimitString,
} from '@witnesschain/shared';

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  file: {
    name: string;
    size: number;
    type: string;
    extension: string;
  } | null;
}

/**
 * Map of file extensions to MIME types for verification
 */
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.gif': ['image/gif'],
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.mov': ['video/quicktime'],
  '.mp3': ['audio/mpeg'],
  '.wav': ['audio/wav'],
  '.ogg': ['audio/ogg'],
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
};

/**
 * Magic bytes for common file types
 * Used to verify file content matches claimed type
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP container)
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'video/mp4': [
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp
    [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], // ftyp variant
    [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // ftyp variant
  ],
  'video/quicktime': [
    [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74], // ftypqt
  ],
  'audio/mpeg': [
    [0xff, 0xfb], // MP3 frame sync
    [0xff, 0xfa],
    [0xff, 0xf3],
    [0xff, 0xf2],
    [0x49, 0x44, 0x33], // ID3 tag
  ],
};

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if file extension matches the MIME type
 */
export function extensionMatchesMimeType(
  extension: string,
  mimeType: string
): boolean {
  const allowedMimes = EXTENSION_MIME_MAP[extension];
  if (!allowedMimes) {
    return false;
  }
  return allowedMimes.includes(mimeType);
}

/**
 * Read the first N bytes of a file for magic byte verification
 */
async function readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
  // Use FileReader for broader compatibility (including jsdom)
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, bytes);
    const reader = new FileReader();
    
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Check if file header matches expected magic bytes
 */
function matchesMagicBytes(header: Uint8Array, patterns: number[][]): boolean {
  for (const pattern of patterns) {
    if (header.length >= pattern.length) {
      let matches = true;
      for (let i = 0; i < pattern.length; i++) {
        if (header[i] !== pattern[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Verify file content matches claimed MIME type using magic bytes
 * Returns true if verification passed or not applicable (type not supported)
 */
async function verifyFileMagicBytes(
  file: File,
  claimedType: string
): Promise<{ valid: boolean; warning?: string }> {
  const patterns = MAGIC_BYTES[claimedType];

  // If we don't have patterns for this type, skip verification
  if (!patterns) {
    return { valid: true };
  }

  // Read enough bytes to check all patterns
  const maxPatternLength = Math.max(...patterns.map((p) => p.length));
  const header = await readFileHeader(file, maxPatternLength);

  if (!matchesMagicBytes(header, patterns)) {
    return {
      valid: false,
      warning: `File content does not match expected format for ${claimedType}`,
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get human-readable list of allowed file types
 */
export function getAllowedFileTypesDisplay(): string {
  const typeGroups: Record<string, string[]> = {
    Images: [],
    Videos: [],
    Audio: [],
    Documents: [],
  };

  for (const mimeType of ALLOWED_FILE_TYPES) {
    if (mimeType.startsWith('image/')) {
      typeGroups.Images.push(mimeType.split('/')[1].toUpperCase());
    } else if (mimeType.startsWith('video/')) {
      typeGroups.Videos.push(mimeType.split('/')[1].toUpperCase());
    } else if (mimeType.startsWith('audio/')) {
      typeGroups.Audio.push(mimeType.split('/')[1].toUpperCase());
    } else {
      typeGroups.Documents.push(mimeType.split('/')[1].toUpperCase());
    }
  }

  const parts: string[] = [];
  for (const [category, types] of Object.entries(typeGroups)) {
    if (types.length > 0) {
      parts.push(`${category}: ${types.join(', ')}`);
    }
  }

  return parts.join(' | ');
}

/**
 * Validate a file for upload
 * Performs comprehensive validation including:
 * - MIME type check
 * - File size limits
 * - Extension verification
 * - Magic bytes verification (when applicable)
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const extension = getFileExtension(file.name);

  const result: FileValidationResult = {
    isValid: false,
    errors,
    warnings,
    file: {
      name: file.name,
      size: file.size,
      type: file.type,
      extension,
    },
  };

  // Check file size minimum
  if (file.size < FILE_SIZE_LIMITS.MIN_BYTES) {
    errors.push(
      `File is too small. Minimum size is ${FILE_SIZE_LIMITS.MIN_BYTES} bytes.`
    );
  }

  // Check file size maximum
  if (file.size > FILE_SIZE_LIMITS.MAX_BYTES) {
    errors.push(
      `File is too large. Maximum size is ${getFileSizeLimitString()}.`
    );
  }

  // Check MIME type
  if (!file.type) {
    errors.push(
      'Unable to determine file type. Please ensure the file has a valid extension.'
    );
  } else if (!isAllowedFileType(file.type)) {
    errors.push(
      `File type "${file.type}" is not supported. Allowed types: ${getAllowedFileTypesDisplay()}`
    );
  }

  // Check extension matches MIME type
  if (extension && file.type) {
    if (!extensionMatchesMimeType(extension, file.type)) {
      warnings.push(
        `File extension (${extension}) may not match content type (${file.type}).`
      );
    }
  }

  // Verify magic bytes if applicable
  if (file.type && errors.length === 0) {
    const magicResult = await verifyFileMagicBytes(file, file.type);
    if (!magicResult.valid && magicResult.warning) {
      warnings.push(magicResult.warning);
    }
  }

  result.isValid = errors.length === 0;
  return result;
}

/**
 * Validate multiple files
 */
export async function validateFiles(
  files: FileList | File[]
): Promise<FileValidationResult[]> {
  const fileArray = Array.from(files);
  return Promise.all(fileArray.map(validateFile));
}

/**
 * Check if a file can be uploaded (quick check without async operations)
 */
export function canUploadFile(file: File): { allowed: boolean; reason?: string } {
  if (file.size < FILE_SIZE_LIMITS.MIN_BYTES) {
    return {
      allowed: false,
      reason: `File too small (minimum ${FILE_SIZE_LIMITS.MIN_BYTES} bytes)`,
    };
  }

  if (file.size > FILE_SIZE_LIMITS.MAX_BYTES) {
    return {
      allowed: false,
      reason: `File too large (maximum ${getFileSizeLimitString()})`,
    };
  }

  if (!file.type || !isAllowedFileType(file.type)) {
    return {
      allowed: false,
      reason: `File type not supported`,
    };
  }

  return { allowed: true };
}

/**
 * Get accept string for file input element
 */
export function getFileInputAccept(): string {
  return ALLOWED_FILE_TYPES.join(',');
}

/**
 * File validation error class
 */
export class FileValidationError extends Error {
  constructor(
    public readonly errors: string[],
    public readonly warnings: string[] = []
  ) {
    super(errors.join('; '));
    this.name = 'FileValidationError';
  }
}

