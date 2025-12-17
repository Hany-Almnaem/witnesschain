'use client';

/**
 * PasswordPrompt Component
 * 
 * Handles password input for:
 * - New user setup (create password)
 * - Existing user login (enter password)
 * 
 * Includes password strength indicator for new users.
 */

import { useState, useCallback, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, AlertCircle, Shield, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PasswordPromptProps {
  mode: 'create' | 'unlock';
  walletAddress?: string;
  did?: string;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (password: string) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

import { 
  validatePassword, 
  PASSWORD_REQUIREMENTS,
  type PasswordStrength,
} from '@witnesschain/shared';

const strengthColors: Record<PasswordStrength, string> = {
  weak: 'bg-red-500',
  fair: 'bg-yellow-500',
  good: 'bg-blue-500',
  strong: 'bg-green-500',
};

const strengthLabels: Record<PasswordStrength, string> = {
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

export function PasswordPrompt({
  mode,
  walletAddress,
  did,
  isLoading = false,
  error,
  onSubmit,
  onCancel,
  className,
}: PasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isCreate = mode === 'create';
  const validation = isCreate ? validatePassword(password) : null;
  const strength = validation?.strength ?? null;

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setLocalError(null);

      // Validation for create mode - use shared validation
      if (isCreate) {
        const result = validatePassword(password);
        if (!result.isValid) {
          setLocalError(result.errors[0] || 'Please choose a stronger password');
          return;
        }

        if (password !== confirmPassword) {
          setLocalError('Passwords do not match');
          return;
        }
      } else {
        // Unlock mode - just check minimum length
        if (password.length < 1) {
          setLocalError('Password is required');
          return;
        }
      }

      try {
        await onSubmit(password);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'An error occurred');
      }
    },
    [password, confirmPassword, isCreate, onSubmit]
  );

  const displayError = error || localError;

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          {isCreate ? (
            <Shield className="h-8 w-8 text-primary" />
          ) : (
            <Lock className="h-8 w-8 text-primary" />
          )}
        </div>
        <CardTitle>
          {isCreate ? 'Create Your Password' : 'Enter Your Password'}
        </CardTitle>
        <CardDescription>
          {isCreate
            ? 'This password protects your encryption keys. Choose a strong password and remember it - it cannot be recovered.'
            : 'Enter your password to unlock your WitnessChain identity.'}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Wallet/DID Info */}
          {(walletAddress || did) && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              {walletAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Wallet:</span>
                  <span className="font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                </div>
              )}
              {did && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Identity:</span>
                  <span className="font-mono text-xs">
                    {did.slice(0, 20)}...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {displayError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{displayError}</p>
            </div>
          )}

          {/* Password Input */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium leading-none"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                className="pr-10"
                autoComplete={isCreate ? 'new-password' : 'current-password'}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Password Strength (Create mode only) */}
          {isCreate && password.length > 0 && strength && (
            <div className="space-y-2">
              <div className="flex gap-1">
                {(['weak', 'fair', 'good', 'strong'] as PasswordStrength[]).map(
                  (level, i) => (
                    <div
                      key={level}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors',
                        i <=
                          ['weak', 'fair', 'good', 'strong'].indexOf(strength)
                          ? strengthColors[strength]
                          : 'bg-muted'
                      )}
                    />
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Password strength: {strengthLabels[strength]}
              </p>
            </div>
          )}

          {/* Confirm Password (Create mode only) */}
          {isCreate && (
            <div className="space-y-2">
              <label
                htmlFor="confirm-password"
                className="text-sm font-medium leading-none"
              >
                Confirm Password
              </label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          )}

          {/* Warning for Create mode */}
          {isCreate && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <p className="font-medium">⚠️ Important</p>
              <p className="mt-1">
                This password cannot be recovered. If you forget it, you will
                lose access to your encrypted evidence.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading} className="flex-1">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isCreate ? 'Creating...' : 'Unlocking...'}
              </>
            ) : isCreate ? (
              'Create Identity'
            ) : (
              'Unlock'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/**
 * Inline password dialog for protected actions
 */
export function PasswordDialog({
  isOpen,
  onClose,
  onSubmit,
  title = 'Enter Password',
  description = 'Enter your password to continue.',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  title?: string;
  description?: string;
}) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onSubmit(password);
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={isLoading}
              autoFocus
            />
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirm'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

