'use client';

/**
 * Dashboard Layout
 * 
 * Protected layout for authenticated users.
 * Includes navigation header and session guard.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Upload, 
  FileSearch, 
  User as UserIcon, 
  LogOut,
  Menu,
} from 'lucide-react';
import { useState } from 'react';

import { SessionGuard } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { formatAddress } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGuard>
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </SessionGuard>
  );
}

function DashboardHeader() {
  const { walletAddress, did, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Shield className="h-6 w-6 text-primary" />
          <span>WitnessChain</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <NavLink href="/dashboard" icon={FileSearch}>
            Evidence
          </NavLink>
          <NavLink href="/dashboard/upload" icon={Upload}>
            Upload
          </NavLink>
          <NavLink href="/dashboard/profile" icon={UserIcon}>
            Profile
          </NavLink>
        </nav>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          <div className="hidden text-right text-sm md:block">
            <div className="font-medium">
              {walletAddress && formatAddress(walletAddress)}
            </div>
            <div className="text-xs text-muted-foreground">
              {did && `${did.slice(0, 20)}...`}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="border-t bg-background p-4 md:hidden">
          <div className="flex flex-col gap-2">
            <MobileNavLink href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              Evidence
            </MobileNavLink>
            <MobileNavLink href="/dashboard/upload" onClick={() => setMobileMenuOpen(false)}>
              Upload
            </MobileNavLink>
            <MobileNavLink href="/dashboard/profile" onClick={() => setMobileMenuOpen(false)}>
              Profile
            </MobileNavLink>
          </div>
        </nav>
      )}
    </header>
  );
}

function NavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ElementType;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg px-4 py-2 text-sm hover:bg-muted"
    >
      {children}
    </Link>
  );
}

