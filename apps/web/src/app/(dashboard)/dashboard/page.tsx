'use client';

/**
 * Dashboard Page
 * 
 * Main dashboard showing user's evidence and quick actions.
 */

import Link from 'next/link';
import { Upload, FileSearch, Shield, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { formatAddress, formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const { walletAddress, did, isNewUser } = useAuth();

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

      {/* Recent Activity */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>
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
      </section>

      {/* Stats */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Your Statistics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Evidence Submitted" value="0" />
          <StatCard title="Verified" value="0" />
          <StatCard title="Pending Verification" value="0" />
          <StatCard title="Total Storage Used" value="0 KB" />
        </div>
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

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

