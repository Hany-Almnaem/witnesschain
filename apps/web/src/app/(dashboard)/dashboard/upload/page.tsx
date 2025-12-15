'use client';

/**
 * Evidence Upload Page
 *
 * Composes the existing UploadForm with API integration.
 * Handles upload flow and navigation on success.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, ExternalLink } from 'lucide-react';

import { UploadForm, type EncryptedEvidencePayload, type UploadProgress, type UploadResult } from '@/components/evidence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api';

/**
 * Upload page component
 * Wires UploadForm with backend API
 */
export default function UploadPage() {
  const router = useRouter();
  const { publicKey, did } = useAuth();
  
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    state: 'idle',
    progress: 0,
    message: '',
  });
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  /**
   * Handle form submission
   * Sends encrypted data to backend API
   */
  const handleSubmit = useCallback(
    async (payload: EncryptedEvidencePayload): Promise<UploadResult> => {
      setUploadProgress({
        state: 'uploading',
        progress: 10,
        message: 'Preparing upload...',
      });

      try {
        // Convert Uint8Array to base64 for JSON transport
        const encryptedDataBase64 = btoa(
          String.fromCharCode(...payload.encryptedData)
        );

        setUploadProgress({
          state: 'uploading',
          progress: 30,
          message: 'Uploading to Filecoin...',
        });

        // Build request body matching backend schema
        const requestBody = {
          metadata: payload.metadata,
          encryption: payload.encryption,
          file: {
            name: payload.file.name,
            size: payload.file.size,
            type: payload.file.mimeType,
          },
          encryptedData: encryptedDataBase64,
        };

        // Send to API
        const response = await authFetch('/api/evidence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        setUploadProgress({
          state: 'uploading',
          progress: 70,
          message: 'Processing storage...',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Upload failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !result.data) {
          throw new Error(result.message || 'Upload failed');
        }

        setUploadProgress({
          state: 'registering',
          progress: 90,
          message: 'Registering on-chain...',
        });

        // Small delay to show registration step
        await new Promise((resolve) => setTimeout(resolve, 500));

        const uploadResult: UploadResult = {
          evidenceId: result.data.evidenceId,
          pieceCid: result.data.pieceCid,
          txHash: result.data.txHash || '',
          contentHash: result.data.contentHash,
        };

        setUploadResult(uploadResult);
        setUploadProgress({
          state: 'success',
          progress: 100,
          message: 'Evidence uploaded successfully!',
        });

        return uploadResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setUploadProgress({
          state: 'error',
          progress: 0,
          message,
        });
        throw error;
      }
    },
    []
  );

  /**
   * Navigate to evidence detail after successful upload
   */
  const handleViewEvidence = useCallback(() => {
    if (uploadResult?.evidenceId) {
      router.push(`/dashboard/evidence/${uploadResult.evidenceId}`);
    }
  }, [router, uploadResult]);

  /**
   * Reset for another upload
   */
  const handleUploadAnother = useCallback(() => {
    setUploadResult(null);
    setUploadProgress({
      state: 'idle',
      progress: 0,
      message: '',
    });
  }, []);

  // Show encryption key not available error
  if (!publicKey) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Upload Evidence</h1>
            <p className="text-muted-foreground">
              Securely upload and encrypt evidence files
            </p>
          </div>
        </div>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Encryption Key Not Available</CardTitle>
            <CardDescription>
              Your encryption key could not be loaded. Please sign in again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/connect">Sign In Again</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success state with navigation options
  if (uploadResult && uploadProgress.state === 'success') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Upload Complete</h1>
            <p className="text-muted-foreground">
              Your evidence has been securely stored
            </p>
          </div>
        </div>

        <Card className="border-green-500">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Evidence Uploaded Successfully</CardTitle>
                <CardDescription>
                  Your evidence is now stored on Filecoin and timestamped on-chain
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Evidence ID */}
            <div className="rounded-lg bg-muted p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Evidence ID</p>
                <p className="font-mono text-sm break-all">{uploadResult.evidenceId}</p>
              </div>
              
              {/* PieceCID */}
              <div>
                <p className="text-xs text-muted-foreground">Filecoin PieceCID</p>
                <p className="font-mono text-sm break-all">{uploadResult.pieceCid}</p>
              </div>
              
              {/* Transaction Hash */}
              {uploadResult.txHash && (
                <div>
                  <p className="text-xs text-muted-foreground">Transaction Hash</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm break-all">{uploadResult.txHash}</p>
                    <a
                      href={`https://calibration.filfox.info/en/tx/${uploadResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleViewEvidence} className="flex-1">
                View Evidence Details
              </Button>
              <Button variant="outline" onClick={handleUploadAnother} className="flex-1">
                Upload Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main upload form
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Upload Evidence</h1>
          <p className="text-muted-foreground">
            Securely upload and encrypt evidence files for permanent preservation
          </p>
        </div>
      </div>

      <UploadForm
        onSubmit={handleSubmit}
        encryptionPublicKey={publicKey}
        uploadProgress={uploadProgress}
      />
    </div>
  );
}

