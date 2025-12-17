/**
 * File Validation Tests
 *
 * Tests file type, size, and format validation.
 */

import { describe, it, expect } from 'vitest';
import { FILE_SIZE_LIMITS } from '@witnesschain/shared';

import {
  validateFile,
  getFileExtension,
  extensionMatchesMimeType,
  formatFileSize,
  canUploadFile,
  getFileInputAccept,
  getAllowedFileTypesDisplay,
  FileValidationError,
} from '@/lib/file-validation';

/**
 * Helper to create a mock File object
 */
function createMockFile(
  name: string,
  size: number,
  type: string,
  content?: Uint8Array
): File {
  const actualContent = content ?? new Uint8Array(size);
  // Convert to ArrayBuffer to avoid SharedArrayBuffer type issues
  const buffer = actualContent.buffer.slice(
    actualContent.byteOffset,
    actualContent.byteOffset + actualContent.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type });
  return new File([blob], name, { type });
}

/**
 * Create a file with JPEG magic bytes
 */
function createJpegFile(name: string, size: number): File {
  const content = new Uint8Array(size);
  // JPEG magic bytes
  content[0] = 0xff;
  content[1] = 0xd8;
  content[2] = 0xff;
  return createMockFile(name, size, 'image/jpeg', content);
}

/**
 * Create a file with PNG magic bytes
 */
function createPngFile(name: string, size: number): File {
  const content = new Uint8Array(size);
  // PNG magic bytes
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  pngMagic.forEach((byte, i) => {
    content[i] = byte;
  });
  return createMockFile(name, size, 'image/png', content);
}

/**
 * Create a file with PDF magic bytes
 */
function createPdfFile(name: string, size: number): File {
  const content = new Uint8Array(size);
  // PDF magic bytes: %PDF
  content[0] = 0x25; // %
  content[1] = 0x50; // P
  content[2] = 0x44; // D
  content[3] = 0x46; // F
  return createMockFile(name, size, 'application/pdf', content);
}

describe('File Validation', () => {
  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('photo.jpg')).toBe('.jpg');
      expect(getFileExtension('document.pdf')).toBe('.pdf');
      expect(getFileExtension('video.mp4')).toBe('.mp4');
    });

    it('should handle multiple dots in filename', () => {
      expect(getFileExtension('my.photo.final.jpg')).toBe('.jpg');
      expect(getFileExtension('report.2024.01.pdf')).toBe('.pdf');
    });

    it('should return lowercase extension', () => {
      expect(getFileExtension('PHOTO.JPG')).toBe('.jpg');
      expect(getFileExtension('Document.PDF')).toBe('.pdf');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('noextension')).toBe('');
      expect(getFileExtension('file.')).toBe('');
    });

    it('should handle hidden files', () => {
      expect(getFileExtension('.gitignore')).toBe('.gitignore');
    });
  });

  describe('extensionMatchesMimeType', () => {
    it('should match correct extension to MIME type', () => {
      expect(extensionMatchesMimeType('.jpg', 'image/jpeg')).toBe(true);
      expect(extensionMatchesMimeType('.jpeg', 'image/jpeg')).toBe(true);
      expect(extensionMatchesMimeType('.png', 'image/png')).toBe(true);
      expect(extensionMatchesMimeType('.pdf', 'application/pdf')).toBe(true);
      expect(extensionMatchesMimeType('.mp4', 'video/mp4')).toBe(true);
    });

    it('should reject mismatched extension and MIME type', () => {
      expect(extensionMatchesMimeType('.jpg', 'image/png')).toBe(false);
      expect(extensionMatchesMimeType('.pdf', 'image/jpeg')).toBe(false);
    });

    it('should return false for unknown extensions', () => {
      expect(extensionMatchesMimeType('.xyz', 'application/octet-stream')).toBe(
        false
      );
      expect(extensionMatchesMimeType('.custom', 'custom/type')).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10240)).toBe('10 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
      expect(formatFileSize(200 * 1024 * 1024)).toBe('200 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });
  });

  describe('canUploadFile', () => {
    it('should allow valid file', () => {
      const file = createJpegFile('photo.jpg', 1024);
      const result = canUploadFile(file);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject file that is too small', () => {
      const file = createMockFile('tiny.jpg', 50, 'image/jpeg');
      const result = canUploadFile(file);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('too small');
    });

    it('should reject file that is too large', () => {
      const file = createMockFile(
        'huge.jpg',
        FILE_SIZE_LIMITS.MAX_BYTES + 1,
        'image/jpeg'
      );
      const result = canUploadFile(file);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('too large');
    });

    it('should reject unsupported file type', () => {
      const file = createMockFile('script.exe', 1024, 'application/x-msdownload');
      const result = canUploadFile(file);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not supported');
    });

    it('should reject file with no MIME type', () => {
      const file = createMockFile('unknown', 1024, '');
      const result = canUploadFile(file);
      expect(result.allowed).toBe(false);
    });
  });

  describe('validateFile', () => {
    it('should validate a valid JPEG file', async () => {
      const file = createJpegFile('evidence.jpg', 1024);
      const result = await validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.file).toEqual({
        name: 'evidence.jpg',
        size: 1024,
        type: 'image/jpeg',
        extension: '.jpg',
      });
    });

    it('should validate a valid PNG file', async () => {
      const file = createPngFile('screenshot.png', 2048);
      const result = await validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a valid PDF file', async () => {
      const file = createPdfFile('document.pdf', 5000);
      const result = await validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file below minimum size', async () => {
      const file = createJpegFile('tiny.jpg', FILE_SIZE_LIMITS.MIN_BYTES - 1);
      const result = await validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('too small'))).toBe(
        true
      );
    });

    it('should reject file above maximum size', async () => {
      const file = createMockFile(
        'huge.jpg',
        FILE_SIZE_LIMITS.MAX_BYTES + 1,
        'image/jpeg'
      );
      const result = await validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('too large'))).toBe(
        true
      );
    });

    it('should reject unsupported file type', async () => {
      const file = createMockFile('virus.exe', 1024, 'application/x-msdownload');
      const result = await validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('not supported'))).toBe(
        true
      );
    });

    it('should warn about mismatched extension', async () => {
      // Create a JPEG file with .png extension
      const content = new Uint8Array(1024);
      content[0] = 0xff;
      content[1] = 0xd8;
      content[2] = 0xff;
      const file = createMockFile('photo.png', 1024, 'image/jpeg', content);

      const result = await validateFile(file);

      // Still valid because content type is checked, not extension
      expect(result.isValid).toBe(true);
      // But should have a warning about extension mismatch
      expect(result.warnings.some((w) => w.toLowerCase().includes('extension'))).toBe(
        true
      );
    });

    it('should warn about mismatched magic bytes', async () => {
      // Create a file that claims to be JPEG but has wrong magic bytes
      const content = new Uint8Array(1024);
      // Random bytes, not JPEG magic
      content[0] = 0x00;
      content[1] = 0x00;
      content[2] = 0x00;
      const file = createMockFile('fake.jpg', 1024, 'image/jpeg', content);

      const result = await validateFile(file);

      // Still valid (we only warn, not reject)
      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.toLowerCase().includes('does not match'))).toBe(
        true
      );
    });

    it('should handle file with no type', async () => {
      const file = createMockFile('unknown', 1024, '');
      const result = await validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('unable to determine'))).toBe(
        true
      );
    });
  });

  describe('getFileInputAccept', () => {
    it('should return comma-separated MIME types', () => {
      const accept = getFileInputAccept();
      expect(accept).toContain('image/jpeg');
      expect(accept).toContain('image/png');
      expect(accept).toContain('video/mp4');
      expect(accept).toContain('application/pdf');
      expect(accept.split(',')).toHaveLength(12); // All allowed types
    });
  });

  describe('getAllowedFileTypesDisplay', () => {
    it('should return human-readable file type list', () => {
      const display = getAllowedFileTypesDisplay();
      expect(display).toContain('Images:');
      expect(display).toContain('Videos:');
      expect(display).toContain('Audio:');
      expect(display).toContain('Documents:');
      expect(display).toContain('JPEG');
      expect(display).toContain('PNG');
      expect(display).toContain('MP4');
      expect(display).toContain('PDF');
    });
  });

  describe('FileValidationError', () => {
    it('should create error with message from errors array', () => {
      const error = new FileValidationError(
        ['Error 1', 'Error 2'],
        ['Warning 1']
      );

      expect(error.name).toBe('FileValidationError');
      expect(error.message).toBe('Error 1; Error 2');
      expect(error.errors).toEqual(['Error 1', 'Error 2']);
      expect(error.warnings).toEqual(['Warning 1']);
    });

    it('should be instanceof Error', () => {
      const error = new FileValidationError(['Test error']);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FileValidationError);
    });
  });
});

