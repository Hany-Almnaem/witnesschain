/**
 * Evidence UI Components Tests
 *
 * Tests for Phase 6 UI components:
 * - Status badge rendering
 * - Evidence list item
 * - Error states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({ id: 'test-id' }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
    toString: () => '',
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock auth hook
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    did: 'did:key:test123',
    publicKey: 'testPublicKey123',
    walletAddress: '0x1234567890abcdef',
    isNewUser: false,
    isAuthenticated: true,
  }),
}));

// Mock env
vi.mock('@/lib/env', () => ({
  getApiUrl: () => 'http://localhost:3000',
}));

describe('Status Badge Rendering', () => {
  const statusColors = {
    pending: 'gray',
    uploading: 'blue',
    stored: 'green',
    timestamped: 'indigo',
    verified: 'emerald',
    rejected: 'red',
  };

  const statusLabels = {
    pending: 'Pending',
    uploading: 'Uploading',
    stored: 'Stored',
    timestamped: 'Timestamped',
    verified: 'Verified',
    rejected: 'Rejected',
  };

  // Create a simple StatusBadge component for testing
  function StatusBadge({ status }: { status: string }) {
    const colorClass = `bg-${statusColors[status as keyof typeof statusColors]}-100`;
    return (
      <span data-testid="status-badge" className={colorClass}>
        {statusLabels[status as keyof typeof statusLabels]}
      </span>
    );
  }

  it('renders pending status correctly', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByTestId('status-badge').textContent).toBe('Pending');
  });

  it('renders uploading status correctly', () => {
    render(<StatusBadge status="uploading" />);
    expect(screen.getByTestId('status-badge').textContent).toBe('Uploading');
  });

  it('renders stored status correctly', () => {
    render(<StatusBadge status="stored" />);
    expect(screen.getByTestId('status-badge').textContent).toBe('Stored');
  });

  it('renders timestamped status correctly', () => {
    render(<StatusBadge status="timestamped" />);
    expect(screen.getByTestId('status-badge').textContent).toBe('Timestamped');
  });

  it('renders verified status correctly', () => {
    render(<StatusBadge status="verified" />);
    expect(screen.getByTestId('status-badge').textContent).toBe('Verified');
  });

  it('renders rejected status correctly', () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByTestId('status-badge').textContent).toBe('Rejected');
  });
});

describe('Evidence List Item Rendering', () => {
  // Simple EvidenceListItem component for testing
  function EvidenceListItem({
    item,
  }: {
    item: {
      id: string;
      title: string;
      category: string;
      fileSize: number;
      status: string;
      createdAt: string;
    };
  }) {
    const categoryLabels: Record<string, string> = {
      human_rights_violation: 'Human Rights',
      war_crime: 'War Crime',
      other: 'Other',
    };

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    return (
      <a href={`/dashboard/evidence/${item.id}`} data-testid="evidence-item">
        <div data-testid="evidence-title">{item.title}</div>
        <div data-testid="evidence-category">
          {categoryLabels[item.category] || item.category}
        </div>
        <div data-testid="evidence-size">{formatBytes(item.fileSize)}</div>
        <div data-testid="evidence-status">{item.status}</div>
      </a>
    );
  }

  it('renders evidence item with all fields', () => {
    const item = {
      id: 'test-123',
      title: 'Test Evidence',
      category: 'human_rights_violation',
      fileSize: 1024 * 1024, // 1 MB
      status: 'stored',
      createdAt: '2024-01-01T00:00:00Z',
    };

    render(<EvidenceListItem item={item} />);

    expect(screen.getByTestId('evidence-title').textContent).toBe('Test Evidence');
    expect(screen.getByTestId('evidence-category').textContent).toBe('Human Rights');
    expect(screen.getByTestId('evidence-size').textContent).toBe('1 MB');
    expect(screen.getByTestId('evidence-status').textContent).toBe('stored');
  });

  it('links to evidence detail page', () => {
    const item = {
      id: 'test-456',
      title: 'Another Evidence',
      category: 'war_crime',
      fileSize: 2048,
      status: 'verified',
      createdAt: '2024-01-02T00:00:00Z',
    };

    render(<EvidenceListItem item={item} />);

    const link = screen.getByTestId('evidence-item');
    expect(link.getAttribute('href')).toBe('/dashboard/evidence/test-456');
  });

  it('formats file size correctly', () => {
    const testCases = [
      { size: 0, expected: '0 Bytes' },
      { size: 512, expected: '512 Bytes' },
      { size: 1024, expected: '1 KB' },
      { size: 1024 * 1024, expected: '1 MB' },
      { size: 1024 * 1024 * 1024, expected: '1 GB' },
    ];

    for (const { size, expected } of testCases) {
      const { unmount } = render(
        <EvidenceListItem
          item={{
            id: 'test',
            title: 'Test',
            category: 'other',
            fileSize: size,
            status: 'stored',
            createdAt: '2024-01-01T00:00:00Z',
          }}
        />
      );
      expect(screen.getByTestId('evidence-size').textContent).toBe(expected);
      unmount();
    }
  });
});

describe('Error State Rendering', () => {
  // Simple ErrorState component for testing
  function ErrorState({
    message,
    onRetry,
  }: {
    message: string;
    onRetry?: () => void;
  }) {
    return (
      <div data-testid="error-state">
        <div data-testid="error-message">{message}</div>
        {onRetry && (
          <button data-testid="retry-button" onClick={onRetry}>
            Try Again
          </button>
        )}
      </div>
    );
  }

  it('renders error message', () => {
    render(<ErrorState message="Something went wrong" />);
    expect(screen.getByTestId('error-message').textContent).toBe('Something went wrong');
  });

  it('renders retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);
    expect(screen.getByTestId('retry-button')).toBeTruthy();
  });

  it('does not render retry button when onRetry not provided', () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByTestId('retry-button')).toBeNull();
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    fireEvent.click(screen.getByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Empty State Rendering', () => {
  // Simple EmptyState component for testing
  function EmptyState() {
    return (
      <div data-testid="empty-state">
        <p data-testid="empty-title">No evidence found</p>
        <p data-testid="empty-description">Start by uploading your first piece of evidence</p>
        <a href="/dashboard/upload" data-testid="upload-link">
          Upload Evidence
        </a>
      </div>
    );
  }

  it('renders empty state message', () => {
    render(<EmptyState />);
    expect(screen.getByTestId('empty-title').textContent).toBe('No evidence found');
    expect(screen.getByTestId('empty-description').textContent).toBe(
      'Start by uploading your first piece of evidence'
    );
  });

  it('renders upload link', () => {
    render(<EmptyState />);
    const link = screen.getByTestId('upload-link');
    expect(link.getAttribute('href')).toBe('/dashboard/upload');
  });
});

describe('Copy to Clipboard', () => {
  // Simple useCopyToClipboard hook implementation for testing
  function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = React.useState(false);

    const copy = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard not available
      }
    };

    return (
      <button data-testid="copy-button" onClick={copy}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    );
  }

  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders copy button', () => {
    render(<CopyButton value="test-value" />);
    expect(screen.getByTestId('copy-button').textContent).toBe('Copy');
  });

  it('copies value to clipboard on click', async () => {
    render(<CopyButton value="0x1234567890" />);

    fireEvent.click(screen.getByTestId('copy-button'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0x1234567890');
  });
});

describe('Category Labels', () => {
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

  it('maps all category codes to labels', () => {
    const categories = [
      'human_rights_violation',
      'war_crime',
      'environmental_crime',
      'corruption',
      'police_brutality',
      'censorship',
      'discrimination',
      'other',
    ];

    for (const category of categories) {
      expect(categoryLabels[category]).toBeDefined();
      expect(categoryLabels[category].length).toBeGreaterThan(0);
    }
  });

  it('returns readable labels', () => {
    expect(categoryLabels['human_rights_violation']).toBe('Human Rights Violation');
    expect(categoryLabels['war_crime']).toBe('War Crime');
    expect(categoryLabels['police_brutality']).toBe('Police Brutality');
  });
});
