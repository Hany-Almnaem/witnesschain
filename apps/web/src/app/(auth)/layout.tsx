import type { ReactNode } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';

/**
 * Auth Layout
 * 
 * Provides a centered layout for authentication pages.
 * Minimal design to focus on the auth flow.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Shield className="h-6 w-6 text-primary" />
            <span>WitnessChain</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}

