'use client';

/**
 * Dashboard Page
 *
 * Main dashboard showing user's evidence metrics and quick actions.
 * Fetches real data from API.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileSearch,
  Shield,
  CheckCircle,
  Clock,
  HardDrive,
  AlertCircle,
  Loader2,
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
import { useAuth } from '@/hooks/use-auth';
import { formatAddress, formatDate, formatBytes } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';

/**
 * Evidence status type
 */
type EvidenceStatus = 'pending' | 'uploading' | 'stored' | 'timestamped' | 'verified' | 'rejected';

/**
 * Evidence item from API
 */
interface EvidenceItem {
  id: string;
  title: string;
  category: string;
  fileSize: number;
  status: EvidenceStatus;
  createdAt: string;
}

/**
 * Dashboard metrics
 */
interface DashboardMetrics {
  total: number;
  byStatus: Record<EvidenceStatus, number>;
  totalStorage: number;
  recentItems: EvidenceItem[];
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

export default function DashboardPage() {
  const router = useRouter();
  const { walletAddress, did, isNewUser } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch dashboard metrics from API
   */
  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all evidence to compute metrics
      const response = await authFetch('/api/evidence?limit=100');

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/connect');
          return;
        }
        throw new Error(`Failed to load data: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to load data');
      }

      const items = result.data.items as EvidenceItem[];

      // Compute metrics
      const byStatus: Record<EvidenceStatus, number> = {
        pending: 0,
        uploading: 0,
        stored: 0,
        timestamped: 0,
        verified: 0,
        rejected: 0,
      };

      let totalStorage = 0;

      for (const item of items) {
        byStatus[item.status] = (byStatus[item.status] || 0) + 1;
        totalStorage += item.fileSize;
      }

      setMetrics({
        total: result.data.pagination.total,
        byStatus,
        totalStorage,
        recentItems: items.slice(0, 5),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Fetch on mount
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Calculate on-chain count (timestamped + verified)
  const onChainCount = metrics
    ? (metrics.byStatus.timestamped || 0) + (metrics.byStatus.verified || 0)
    : 0;

  // Calculate pending verification (stored but not timestamped)
  const pendingVerification = metrics
    ? (metrics.byStatus.stored || 0)
    : 0;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome to WitnessChain. Preserve and protect human rights evidence.
        </p>
      </section>

      {/* New User Welcome */}
      {isNewUser && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Identity Created Successfully
            </CardTitle>
            <CardDescription>
              Your WitnessChain identity has been created and linked to your wallet.
              You can now upload and manage evidence securely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Wallet:</span>{' '}
                <span className="font-mono">
                  {walletAddress && formatAddress(walletAddress)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Identity:</span>{' '}
                <span className="font-mono">{did && `${did.slice(0, 30)}...`}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            icon={Upload}
            title="Upload Evidence"
            description="Securely upload and encrypt evidence files"
            href="/dashboard/upload"
          />
          <QuickActionCard
            icon={FileSearch}
            title="Browse Evidence"
            description="View and manage your submitted evidence"
            href="/dashboard/evidence"
          />
          <QuickActionCard
            icon={Shield}
            title="Verify Evidence"
            description="Check the blockchain proof for any evidence"
            href="/dashboard/verify"
          />
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Your Statistics</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" className="text-primary" />
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={fetchMetrics}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Evidence Submitted"
              value={metrics?.total.toString() || '0'}
              icon={FileSearch}
            />
            <StatCard
              title="On-Chain"
              value={onChainCount.toString()}
              icon={Shield}
              description="Timestamped + Verified"
            />
            <StatCard
              title="Pending On-Chain"
              value={pendingVerification.toString()}
              icon={Clock}
              description="Stored, awaiting timestamp"
            />
            <StatCard
              title="Total Storage"
              value={formatBytes(metrics?.totalStorage || 0)}
              icon={HardDrive}
            />
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          {metrics && metrics.recentItems.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/evidence">View All</Link>
            </Button>
          )}
        </div>
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <Spinner size="lg" className="text-primary" />
              </div>
            </CardContent>
          </Card>
        ) : metrics && metrics.recentItems.length > 0 ? (
          <div className="space-y-3">
            {metrics.recentItems.map((item) => (
              <Link key={item.id} href={`/dashboard/evidence/${item.id}`}>
                <Card className="transition-colors hover:border-primary/50 hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          statusColors[item.status]
                        )}
                      >
                        {statusLabels[item.status]}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6">
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <FileSearch className="mb-4 h-12 w-12 opacity-50" />
                <p className="text-lg font-medium">No evidence submitted yet</p>
                <p className="mt-1">
                  Start by uploading your first piece of evidence
                </p>
                <Button asChild className="mt-4">
                  <Link href="/dashboard/upload">Upload Evidence</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/50">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  icon?: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
    </Card>
  );
}
