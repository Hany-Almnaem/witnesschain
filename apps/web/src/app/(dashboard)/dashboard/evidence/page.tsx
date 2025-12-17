'use client';

/**
 * Evidence List Page
 *
 * Displays paginated list of user's evidence with filtering by status.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileSearch,
  Upload,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { formatBytes, formatDate } from '@/lib/utils';
import { authFetch } from '@/lib/api';

/**
 * Evidence status type
 */
type EvidenceStatus = 'pending' | 'uploading' | 'stored' | 'timestamped' | 'verified' | 'rejected';

/**
 * Evidence list item from API
 */
interface EvidenceItem {
  id: string;
  title: string;
  category: string;
  pieceCid: string | null;
  contentHash: string;
  fileSize: number;
  mimeType: string;
  status: EvidenceStatus;
  filPaid: string | null;
  txHash: string | null;
  createdAt: string;
}

/**
 * Pagination info from API
 */
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  human_rights_violation: 'Human Rights',
  war_crime: 'War Crime',
  environmental_crime: 'Environmental',
  corruption: 'Corruption',
  police_brutality: 'Police Brutality',
  censorship: 'Censorship',
  discrimination: 'Discrimination',
  other: 'Other',
};

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusColors[status]
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

/**
 * Evidence List Item Component
 */
function EvidenceListItem({ item }: { item: EvidenceItem }) {
  return (
    <Link href={`/dashboard/evidence/${item.id}`}>
      <Card className="transition-colors hover:border-primary/50 hover:bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium truncate">{item.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{categoryLabels[item.category] || item.category}</span>
                <span>•</span>
                <span>{formatBytes(item.fileSize)}</span>
                <span>•</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              {item.pieceCid && (
                <p className="mt-1 font-mono text-xs text-muted-foreground truncate">
                  {item.pieceCid}
                </p>
              )}
            </div>
            <StatusBadge status={item.status} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
          <FileSearch className="mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">No evidence found</p>
          <p className="mt-1">Start by uploading your first piece of evidence</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Evidence
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Error state component
 */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive">
      <CardContent className="py-8">
        <div className="flex flex-col items-center justify-center text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive opacity-50" />
          <p className="text-lg font-medium text-destructive">Failed to load evidence</p>
          <p className="mt-1 text-muted-foreground">{message}</p>
          <Button variant="outline" onClick={onRetry} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center">
          <Spinner size="lg" className="text-primary" />
          <p className="mt-4 text-muted-foreground">Loading evidence...</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Evidence List Page Component
 */
export default function EvidenceListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get current filters from URL
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const currentStatus = searchParams.get('status') as EvidenceStatus | null;

  /**
   * Fetch evidence from API
   */
  const fetchEvidence = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '20');
      if (currentStatus) {
        params.set('status', currentStatus);
      }

      const response = await authFetch(`/api/evidence?${params}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/connect');
          return;
        }
        throw new Error(`Failed to load evidence: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to load evidence');
      }

      setItems(result.data.items);
      setPagination(result.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentStatus, router]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  /**
   * Update URL with new page
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', newPage.toString());
      router.push(`/dashboard/evidence?${params.toString()}`);
    },
    [router, searchParams]
  );

  /**
   * Update URL with status filter
   */
  const handleStatusFilter = useCallback(
    (status: EvidenceStatus | null) => {
      const params = new URLSearchParams();
      params.set('page', '1'); // Reset to first page
      if (status) {
        params.set('status', status);
      }
      router.push(`/dashboard/evidence?${params.toString()}`);
    },
    [router]
  );

  // Status filter options
  const statusOptions: (EvidenceStatus | null)[] = [
    null,
    'pending',
    'uploading',
    'stored',
    'timestamped',
    'verified',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evidence</h1>
          <p className="text-muted-foreground">
            View and manage your submitted evidence
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload Evidence
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Status:</span>
        {statusOptions.map((status) => (
          <Button
            key={status || 'all'}
            variant={currentStatus === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusFilter(status)}
          >
            {status ? statusLabels[status] : 'All'}
          </Button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchEvidence} />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Evidence List */}
          <div className="space-y-3">
            {items.map((item) => (
              <EvidenceListItem key={item.id} item={item} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {items.length} of {pagination.total} items
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

