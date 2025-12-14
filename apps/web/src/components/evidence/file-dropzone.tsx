'use client';

/**
 * File Dropzone Component
 *
 * A drag-and-drop file upload area with validation.
 * Validates file type and size before accepting.
 */

import * as React from 'react';
import { Upload, X, AlertCircle, FileIcon, CheckCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  validateFile,
  formatFileSize,
  getFileInputAccept,
  getAllowedFileTypesDisplay,
  type FileValidationResult,
} from '@/lib/file-validation';

export interface FileDropzoneProps {
  /** Called when a valid file is selected */
  onFileSelect: (file: File, validation: FileValidationResult) => void;
  /** Called when file is removed */
  onFileRemove: () => void;
  /** Currently selected file */
  selectedFile: File | null;
  /** Validation result for selected file */
  validationResult: FileValidationResult | null;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export function FileDropzone({
  onFileSelect,
  onFileRemove,
  selectedFile,
  validationResult,
  disabled = false,
  className,
}: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFile = React.useCallback(
    async (file: File) => {
      setIsValidating(true);
      try {
        const result = await validateFile(file);
        onFileSelect(file, result);
      } finally {
        setIsValidating(false);
      }
    },
    [onFileSelect]
  );

  const handleDrop = React.useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        await processFile(files[0]);
      }
    },
    [disabled, processFile]
  );

  const handleFileInput = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await processFile(files[0]);
      }
      // Reset input to allow selecting the same file again
      e.target.value = '';
    },
    [processFile]
  );

  const openFileDialog = React.useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const hasErrors = validationResult && !validationResult.isValid;
  const hasWarnings =
    validationResult &&
    validationResult.isValid &&
    validationResult.warnings.length > 0;

  return (
    <div className={cn('w-full', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={getFileInputAccept()}
        onChange={handleFileInput}
        disabled={disabled}
        className="hidden"
        aria-label="File upload"
      />

      {!selectedFile ? (
        // Dropzone area when no file is selected
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFileDialog}
          className={cn(
            'relative flex flex-col items-center justify-center w-full h-48 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
            disabled && 'opacity-50 cursor-not-allowed',
            isValidating && 'pointer-events-none'
          )}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFileDialog();
            }
          }}
        >
          {isValidating ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span>Validating file...</span>
            </div>
          ) : (
            <>
              <Upload
                className={cn(
                  'h-10 w-10 mb-3',
                  isDragActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <p className="text-sm font-medium text-center">
                {isDragActive ? (
                  <span className="text-primary">Drop file here</span>
                ) : (
                  <>
                    <span className="text-primary">Click to upload</span>
                    <span className="text-muted-foreground">
                      {' '}
                      or drag and drop
                    </span>
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                {getAllowedFileTypesDisplay()}
              </p>
              <p className="text-xs text-muted-foreground">Max size: 200MB</p>
            </>
          )}
        </div>
      ) : (
        // File preview when file is selected
        <div
          className={cn(
            'relative flex items-start gap-4 w-full p-4 border rounded-lg',
            hasErrors
              ? 'border-destructive bg-destructive/5'
              : hasWarnings
                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                : 'border-primary bg-primary/5'
          )}
        >
          {/* File icon */}
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-lg',
              hasErrors
                ? 'bg-destructive/10'
                : hasWarnings
                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                  : 'bg-primary/10'
            )}
          >
            <FileIcon
              className={cn(
                'h-6 w-6',
                hasErrors
                  ? 'text-destructive'
                  : hasWarnings
                    ? 'text-yellow-600'
                    : 'text-primary'
              )}
            />
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(selectedFile.size)} • {selectedFile.type}
            </p>

            {/* Validation status */}
            {validationResult && (
              <div className="mt-2">
                {validationResult.isValid ? (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <CheckCircle className="h-3 w-3" />
                    <span>File validated</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {validationResult.errors.map((error, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1 text-xs text-destructive"
                      >
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {validationResult.warnings.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {validationResult.warnings.map((warning, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1 text-xs text-yellow-600"
                      >
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={onFileRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove file</span>
          </Button>
        </div>
      )}
    </div>
  );
}

