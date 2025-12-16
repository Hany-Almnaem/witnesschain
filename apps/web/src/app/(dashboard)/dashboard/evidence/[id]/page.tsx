'use client';

/**
 * Evidence Detail Page
 *
 * Displays full evidence details including:
 * - Metadata (title, description, category)
 * - Encryption info (read-only)
 * - Filecoin storage info (PieceCID, explorer link)
 * - On-chain info (txHash, blockNumber, timestamp)
 * - Download button with password-protected decryption
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Copy,
  Check,
  Shield,
  HardDrive,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  Lock,
  CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { PasswordDialog } from '@/components/auth/password-prompt';
import { cn } from '@/lib/utils';
import { formatBytes, formatDate } from '@/lib/utils';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import {
  decryptFile,
  verifyContentHash,
  createDownloadBlob,
  downloadFile,
  DecryptionError,
} from '@/lib/crypto';
import { retrieveSecretKey } from '@/lib/key-storage';
import { getEncryptionSecretKey } from '@/lib/did';

/**
 * Evidence status type
 */
type EvidenceStatus = 'pending' | 'uploading' | 'stored' | 'timestamped' | 'verified' | 'rejected';

/**
 * Evidence detail from API
 */
interface EvidenceDetail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  pieceCid: string | null;
  dataSetId: string | null;
  providerAddress: string | null;
  contentHash: string;
  fileSize: number;
  mimeType: string;
  status: EvidenceStatus;
  filPaid: string | null;
  txHash: string | null;
  blockNumber: number | null;
  onChainTimestamp: number | null;
  metadata: {
    source?: { type: string; name?: string };
    location?: { description?: string };
    date?: string;
    contentWarnings?: string[];
    tags?: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
  encryption: {
    encryptedKey: string;
    ephemeralPublicKey: string;
    fileNonce: string;
    keyNonce: string;
  };
}

/**
 * Status badge colors
 */
const statusColors: Record<EvidenceStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  uploading: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  stored: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  timestamped: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

/**
 * Status labels
 */
const statusLabels: Record<EvidenceStatus, string> = {
  pending: 'Pending',
  uploading: 'Uploading',
  stored: 'Stored',
  timestamped: 'Timestamped',
  verified: 'Verified',
  rejected: 'Rejected',
};

/**
 * Category labels
 */
const categoryLabels: Record<string, string> = {
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
 * Copy to clipboard hook
 */
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return { copied, copy };
}

/**
 * Copy Button Component
 */
function CopyButton({ value }: { value: string }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => copy(value)}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        statusColors[status]
      )}
    >
      {status === 'verified' && <CheckCircle className="mr-1.5 h-4 w-4" />}
      {statusLabels[status]}
    </span>
  );
}

/**
 * Info Row Component
 */
function InfoRow({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  copyable?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex flex-col gap-1 py-2 border-b last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('text-sm break-all', mono && 'font-mono')}>
        <div className="flex items-center gap-2">
          <span className="flex-1">{value}</span>
          {copyable && <CopyButton value={value} />}
        </div>
      </dd>
    </div>
  );
}

/**
 * Evidence Detail Page Component
 */
export default function EvidenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { did } = useAuth();
  const evidenceId = params.id as string;

  // State
  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  /**
   * Fetch evidence details from API
   */
  const fetchEvidence = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/evidence/${evidenceId}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/connect');
          return;
        }
        if (response.status === 403) {
          setError('You do not have access to this evidence.');
          return;
        }
        if (response.status === 404) {
          setError('Evidence not found.');
          return;
        }
        throw new Error(`Failed to load evidence: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to load evidence');
      }

      setEvidence(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [evidenceId, router]);

  // Fetch on mount
  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  /**
   * Handle download button click - show password dialog
   */
  const handleDownloadClick = useCallback(() => {
    setDownloadError(null);
    setShowPasswordDialog(true);
  }, []);

  /**
   * Handle password submission for download
   */
  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      if (!evidence || !did) return;

      setIsDownloading(true);
      setDownloadError(null);

      try {
        // Retrieve Ed25519 secret key using password
        const ed25519SecretKey = await retrieveSecretKey(did, password);

        if (!ed25519SecretKey) {
          throw new Error('Invalid password');
        }

        // Derive X25519 encryption secret key (32 bytes) from Ed25519 secret key (64 bytes)
        // This is required because:
        // - Ed25519 is used for signing (DID)
        // - X25519 is used for encryption (nacl.box)
        let x25519SecretKey: Uint8Array;
        try {
          x25519SecretKey = getEncryptionSecretKey(ed25519SecretKey);
        } finally {
          // Clear Ed25519 key from memory immediately after deriving X25519 key
          ed25519SecretKey.fill(0);
        }

        // Fetch encrypted data from API
        const response = await authFetch(`/api/evidence/${evidenceId}/download`);

        if (!response.ok) {
          x25519SecretKey.fill(0);
          throw new Error(`Download failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          x25519SecretKey.fill(0);
          throw new Error(result.message || 'Download failed');
        }

        // Decode base64 encrypted data
        const encryptedData = new Uint8Array(
          atob(result.data.encryptedData)
            .split('')
            .map((c) => c.charCodeAt(0))
        );

        // Decrypt file using X25519 secret key (32 bytes)
        const decryptedData = decryptFile({
          encryptedData,
          encryptedKey: result.data.encryption.encryptedKey,
          ephemeralPublicKey: result.data.encryption.ephemeralPublicKey,
          fileNonce: result.data.encryption.fileNonce,
          keyNonce: result.data.encryption.keyNonce,
          recipientSecretKey: x25519SecretKey,
        });

        // Clear X25519 key from memory after use
        x25519SecretKey.fill(0);

        // Verify content hash
        const isValid = await verifyContentHash(
          decryptedData,
          result.data.encryption.contentHash
        );

        if (!isValid) {
          throw new Error('Content verification failed. File may be corrupted.');
        }

        // Create blob and trigger download
        const blob = createDownloadBlob(decryptedData, evidence.mimeType);
        const fileName = `${evidence.title}.${getFileExtension(evidence.mimeType)}`;
        downloadFile(blob, fileName);

        setShowPasswordDialog(false);
      } catch (err) {
        if (err instanceof DecryptionError) {
          setDownloadError(err.message);
        } else {
          setDownloadError(
            err instanceof Error ? err.message : 'Download failed'
          );
        }
        throw err; // Re-throw so PasswordDialog shows error
      } finally {
        setIsDownloading(false);
      }
    },
    [evidence, evidenceId, did]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/evidence">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Evidence Details</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Spinner size="lg" className="text-primary" />
              <p className="mt-4 text-muted-foreground">Loading evidence...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/evidence">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Evidence Details</h1>
          </div>
        </div>
        <Card className="border-destructive">
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="mb-4 h-12 w-12 text-destructive opacity-50" />
              <p className="text-lg font-medium text-destructive">{error}</p>
              <div className="mt-4 flex gap-3">
                <Button variant="outline" onClick={fetchEvidence}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/evidence">Back to Evidence List</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!evidence) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link href="/dashboard/evidence">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{evidence.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <StatusBadge status={evidence.status} />
              <span className="text-sm text-muted-foreground">
                {categoryLabels[evidence.category] || evidence.category}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleDownloadClick}
          disabled={isDownloading || !evidence.pieceCid}
        >
          {isDownloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download
            </>
          )}
        </Button>
      </div>

      {/* Download Error */}
      {downloadError && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{downloadError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Metadata */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Evidence Metadata</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <dl>
              <InfoRow label="Title" value={evidence.title} />
              <InfoRow
                label="Description"
                value={evidence.description || 'No description provided'}
              />
              <InfoRow
                label="Category"
                value={categoryLabels[evidence.category] || evidence.category}
              />
              <InfoRow label="File Size" value={formatBytes(evidence.fileSize)} />
              <InfoRow label="File Type" value={evidence.mimeType} />
              <InfoRow label="Created" value={formatDate(evidence.createdAt)} />
              {evidence.metadata?.source && (
                <InfoRow
                  label="Source"
                  value={`${evidence.metadata.source.type}${evidence.metadata.source.name ? ` - ${evidence.metadata.source.name}` : ''}`}
                />
              )}
              {evidence.metadata?.contentWarnings &&
                evidence.metadata.contentWarnings.length > 0 && (
                  <InfoRow
                    label="Content Warnings"
                    value={evidence.metadata.contentWarnings.join(', ')}
                  />
                )}
            </dl>
          </CardContent>
        </Card>

        {/* Encryption Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Encryption</CardTitle>
            </div>
            <CardDescription>
              Your file is encrypted and only you can decrypt it
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <InfoRow
                label="Content Hash (SHA-256)"
                value={evidence.contentHash}
                mono
                copyable
              />
              <InfoRow
                label="Encryption Algorithm"
                value="XSalsa20-Poly1305"
              />
              <InfoRow label="Key Exchange" value="X25519" />
            </dl>
          </CardContent>
        </Card>

        {/* Filecoin Storage */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Filecoin Storage</CardTitle>
            </div>
            <CardDescription>
              Decentralized storage on Filecoin network
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              {evidence.pieceCid ? (
                <>
                  <InfoRow
                    label="PieceCID"
                    value={evidence.pieceCid}
                    mono
                    copyable
                  />
                  {evidence.providerAddress && (
                    <InfoRow
                      label="Storage Provider"
                      value={evidence.providerAddress}
                      mono
                    />
                  )}
                  {evidence.filPaid && (
                    <InfoRow label="FIL Paid" value={`${evidence.filPaid} FIL`} />
                  )}
                </>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Not yet stored on Filecoin
                </p>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* On-Chain Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">On-Chain Proof</CardTitle>
            </div>
            <CardDescription>
              Immutable blockchain timestamp on Filecoin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              {evidence.txHash ? (
                <>
                  <div className="flex flex-col gap-1 py-2 border-b">
                    <dt className="text-xs text-muted-foreground">
                      Transaction Hash
                    </dt>
                    <dd className="text-sm font-mono break-all">
                      <div className="flex items-center gap-2">
                        <span className="flex-1">{evidence.txHash}</span>
                        <CopyButton value={evidence.txHash} />
                        <a
                          href={`https://calibration.filfox.info/en/tx/${evidence.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </dd>
                  </div>
                  {evidence.blockNumber && (
                    <InfoRow
                      label="Block Number"
                      value={evidence.blockNumber.toString()}
                      mono
                    />
                  )}
                  {evidence.onChainTimestamp && (
                    <InfoRow
                      label="On-Chain Timestamp"
                      value={formatDate(evidence.onChainTimestamp * 1000)}
                    />
                  )}
                </>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Not yet registered on-chain
                </p>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Password Dialog for Download */}
      <PasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onSubmit={handlePasswordSubmit}
        title="Enter Password to Download"
        description="Your password is required to decrypt the evidence file."
      />
    </div>
  );
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/json': 'json',
  };

  return mimeToExt[mimeType] || 'bin';
}

