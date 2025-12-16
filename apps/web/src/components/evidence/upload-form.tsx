'use client';

/**
 * Evidence Upload Form Component
 *
 * Complete form for uploading evidence with:
 * - File selection with validation
 * - Metadata input (title, description, category, etc.)
 * - Client-side encryption (ENFORCED - not optional)
 * - Upload progress tracking
 *
 * SECURITY: Encryption is performed INSIDE this component.
 * The onSubmit callback receives encrypted data - plaintext is never exposed.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Lock, Upload, Loader2 } from 'lucide-react';

import {
  evidenceMetadataSchema,
  EVIDENCE_CATEGORIES,
  SOURCE_TYPES,
  CONTENT_WARNINGS,
  sanitizeText,
  type EvidenceMetadata,
} from '@witnesschain/shared';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { FileDropzone } from './file-dropzone';
import type { FileValidationResult } from '@/lib/file-validation';
import {
  encryptFileForUpload,
  type EncryptedFileResult,
  EncryptionError,
} from '@/lib/crypto';

/**
 * Form schema combining file and metadata validation
 * Sanitization is applied via transform BEFORE validation
 */
const uploadFormSchema = evidenceMetadataSchema.transform((data) => ({
  ...data,
  title: sanitizeText(data.title),
  description: data.description ? sanitizeText(data.description) : undefined,
  source: {
    ...data.source,
    name: data.source.name ? sanitizeText(data.source.name) : undefined,
  },
  location: data.location
    ? {
        ...data.location,
        description: data.location.description
          ? sanitizeText(data.location.description)
          : undefined,
      }
    : undefined,
}));

type UploadFormData = z.infer<typeof uploadFormSchema>;

/**
 * Upload state tracking
 */
export type UploadState =
  | 'idle'
  | 'validating'
  | 'encrypting'
  | 'uploading'
  | 'registering'
  | 'success'
  | 'error';

export interface UploadProgress {
  state: UploadState;
  progress: number; // 0-100
  message: string;
}

export interface UploadResult {
  evidenceId: string;
  pieceCid: string;
  txHash: string;
  contentHash: string;
}

/**
 * Encrypted evidence payload - this is what gets submitted
 * Plaintext file content is NEVER passed to onSubmit
 */
export interface EncryptedEvidencePayload {
  /** Encrypted file data */
  encryptedData: Uint8Array;
  /** Encryption metadata required for decryption */
  encryption: {
    encryptedKey: string;
    ephemeralPublicKey: string;
    fileNonce: string;
    keyNonce: string;
    contentHash: string;
  };
  /** Original file metadata (not content) */
  file: {
    name: string;
    size: number;
    mimeType: string;
  };
  /** Sanitized metadata */
  metadata: EvidenceMetadata;
}

export interface UploadFormProps {
  /**
   * Called when form is submitted with ENCRYPTED data
   * The file content is encrypted client-side before this callback is invoked.
   * Plaintext file data is never exposed to the caller.
   */
  onSubmit: (payload: EncryptedEvidencePayload) => Promise<UploadResult>;
  /**
   * User's X25519 encryption public key (base64)
   * Required for encrypting the file. Usually derived from generateEncryptionKeyPair().
   */
  encryptionPublicKey: string;
  /** Upload progress state */
  uploadProgress?: UploadProgress;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Category labels for display
 */
const CATEGORY_LABELS: Record<string, string> = {
  human_rights_violation: 'Human Rights Violation',
  war_crime: 'War Crime',
  environmental_crime: 'Environmental Crime',
  corruption: 'Corruption',
  police_brutality: 'Police Brutality',
  censorship: 'Censorship',
  discrimination: 'Discrimination',
  other: 'Other',
};

/**
 * Source type labels for display
 */
const SOURCE_TYPE_LABELS: Record<string, string> = {
  witness: 'Eyewitness',
  organization: 'Organization',
  anonymous: 'Anonymous',
  media: 'Media/Press',
};

/**
 * Content warning labels for display
 */
const CONTENT_WARNING_LABELS: Record<string, string> = {
  violence: 'Violence',
  death: 'Death',
  abuse: 'Abuse',
  graphic: 'Graphic Content',
  disturbing: 'Disturbing Content',
};

export function UploadForm({
  onSubmit,
  encryptionPublicKey,
  uploadProgress,
  disabled = false,
  className,
}: UploadFormProps) {
  // File state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileValidation, setFileValidation] =
    React.useState<FileValidationResult | null>(null);
  const [encryptionError, setEncryptionError] = React.useState<string | null>(null);

  // Form state
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: undefined,
      source: {
        type: 'witness',
        name: '',
      },
      contentWarnings: [],
      tags: [],
    },
  });

  const sourceType = watch('source.type');

  // Handle file selection
  const handleFileSelect = React.useCallback(
    (file: File, validation: FileValidationResult) => {
      setSelectedFile(file);
      setFileValidation(validation);
      setEncryptionError(null);
    },
    []
  );

  // Handle file removal
  const handleFileRemove = React.useCallback(() => {
    setSelectedFile(null);
    setFileValidation(null);
    setEncryptionError(null);
  }, []);

  // Handle form submission with ENCRYPTION
  const handleFormSubmit = React.useCallback(
    async (data: UploadFormData) => {
      if (!selectedFile || !fileValidation?.isValid) {
        return;
      }

      if (!encryptionPublicKey) {
        setEncryptionError('Encryption key not available. Please try again.');
        return;
      }

      setEncryptionError(null);

      try {
        // SECURITY: Encryption happens HERE, inside the form
        // The onSubmit callback NEVER receives plaintext file content
        const encryptedResult = await encryptFileForUpload(
          selectedFile,
          encryptionPublicKey
        );

        // Build the encrypted payload
        // Note: data is already sanitized via Zod transform
        const payload: EncryptedEvidencePayload = {
          encryptedData: encryptedResult.encryptedData,
          encryption: {
            encryptedKey: encryptedResult.encryptedKey,
            ephemeralPublicKey: encryptedResult.ephemeralPublicKey,
            fileNonce: encryptedResult.fileNonce,
            keyNonce: encryptedResult.keyNonce,
            contentHash: encryptedResult.contentHash,
          },
          file: {
            name: encryptedResult.fileName,
            size: encryptedResult.originalSize,
            mimeType: encryptedResult.mimeType,
          },
          metadata: data as EvidenceMetadata,
        };

        await onSubmit(payload);
      } catch (error) {
        // Only set encryptionError for actual encryption failures
        // API/storage errors are handled by the parent via uploadProgress
        if (error instanceof EncryptionError) {
          setEncryptionError(error.message);
        } else {
          // Re-throw non-encryption errors so parent can handle them
          // via uploadProgress.state = 'error'
          throw error;
        }
      }
    },
    [selectedFile, fileValidation, encryptionPublicKey, onSubmit]
  );

  // Reset form after successful upload
  React.useEffect(() => {
    if (uploadProgress?.state === 'success') {
      reset();
      setSelectedFile(null);
      setFileValidation(null);
    }
  }, [uploadProgress?.state, reset]);

  const isUploading =
    uploadProgress?.state === 'encrypting' ||
    uploadProgress?.state === 'uploading' ||
    uploadProgress?.state === 'registering';

  const formDisabled = disabled || isSubmitting || isUploading;

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn('space-y-6', className)}
    >
      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evidence File</CardTitle>
          <CardDescription>
            Upload the file you want to preserve. It will be encrypted before
            storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropzone
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            selectedFile={selectedFile}
            validationResult={fileValidation}
            disabled={formDisabled}
          />
          {!selectedFile && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Files are encrypted client-side before upload
            </p>
          )}
        </CardContent>
      </Card>

      {/* Metadata Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evidence Details</CardTitle>
          <CardDescription>
            Provide information about the evidence for proper categorization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label
              htmlFor="title"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="title"
              placeholder="Brief descriptive title for the evidence"
              disabled={formDisabled}
              {...register('title')}
              className={cn(errors.title && 'border-destructive')}
            />
            {errors.title && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="description"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Description
            </label>
            <textarea
              id="description"
              placeholder="Detailed description of what the evidence shows and its context (min 20 characters)"
              disabled={formDisabled}
              {...register('description')}
              className={cn(
                'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                errors.description && 'border-destructive'
              )}
            />
            {errors.description && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label
              htmlFor="category"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Category <span className="text-destructive">*</span>
            </label>
            <select
              id="category"
              disabled={formDisabled}
              {...register('category')}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                errors.category && 'border-destructive'
              )}
            >
              <option value="">Select a category...</option>
              {EVIDENCE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.category.message}
              </p>
            )}
          </div>

          {/* Source Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="source-type"
                className="text-sm font-medium leading-none"
              >
                Source Type <span className="text-destructive">*</span>
              </label>
              <select
                id="source-type"
                disabled={formDisabled}
                {...register('source.type')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {SOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SOURCE_TYPE_LABELS[type] || type}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Name (hidden for anonymous) */}
            {sourceType !== 'anonymous' && (
              <div className="space-y-2">
                <label
                  htmlFor="source-name"
                  className="text-sm font-medium leading-none"
                >
                  Source Name
                </label>
                <Input
                  id="source-name"
                  placeholder={
                    sourceType === 'organization'
                      ? 'Organization name'
                      : 'Your name (optional)'
                  }
                  disabled={formDisabled}
                  {...register('source.name')}
                />
              </div>
            )}
          </div>

          {/* Content Warnings */}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              Content Warnings
            </label>
            <p className="text-xs text-muted-foreground">
              Select any warnings that apply to this content
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {CONTENT_WARNINGS.map((warning) => (
                <label
                  key={warning}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors',
                    'hover:bg-muted',
                    formDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <input
                    type="checkbox"
                    value={warning}
                    disabled={formDisabled}
                    {...register('contentWarnings')}
                    className="h-4 w-4 rounded border-input"
                  />
                  {CONTENT_WARNING_LABELS[warning] || warning}
                </label>
              ))}
            </div>
          </div>

          {/* Location (optional) */}
          <div className="space-y-2">
            <label
              htmlFor="location"
              className="text-sm font-medium leading-none"
            >
              Location (optional)
            </label>
            <Input
              id="location"
              placeholder="Description of where this occurred"
              disabled={formDisabled}
              {...register('location.description')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Encryption Error */}
      {encryptionError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Encryption Failed</p>
                <p className="text-sm">{encryptionError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {uploadProgress && uploadProgress.state !== 'idle' && (
        <Card
          className={cn(
            uploadProgress.state === 'error' && 'border-destructive',
            uploadProgress.state === 'success' && 'border-green-500'
          )}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{uploadProgress.message}</span>
                {isUploading && (
                  <span className="text-muted-foreground">
                    {uploadProgress.progress}%
                  </span>
                )}
              </div>

              {isUploading && (
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
              )}

              {uploadProgress.state === 'error' && (
                <p className="text-xs text-destructive">
                  Please try again or contact support if the problem persists.
                </p>
              )}

              {uploadProgress.state === 'success' && (
                <p className="text-xs text-green-600">
                  Your evidence has been securely stored and timestamped on-chain.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={
          formDisabled ||
          !selectedFile ||
          !fileValidation?.isValid
        }
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {uploadProgress?.message || 'Uploading...'}
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Encrypt & Upload Evidence
          </>
        )}
      </Button>

      {/* Security Notice */}
      <p className="text-xs text-center text-muted-foreground">
        <Lock className="inline h-3 w-3 mr-1" />
        Your file is encrypted locally before upload. Only you can decrypt it.
      </p>
    </form>
  );
}

