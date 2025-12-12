/**
 * Authentication Module Tests
 * 
 * Tests for the core authentication functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  getDIDForWallet,
  setDIDForWallet,
  clearDIDForWallet,
  getSession,
  setSession,
  clearSession,
  AuthError,
} from '../lib/auth';

describe('Auth Module', () => {
  beforeEach(() => {
    // Clear storage before each test
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('Wallet-DID Mapping', () => {
    const testWallet = '0x1234567890123456789012345678901234567890';
    const testDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('should store and retrieve DID for wallet', () => {
      setDIDForWallet(testWallet, testDid);
      const retrieved = getDIDForWallet(testWallet);
      expect(retrieved).toBe(testDid);
    });

    it('should normalize wallet address to lowercase', () => {
      const upperWallet = '0x1234567890123456789012345678901234567890'.toUpperCase();
      setDIDForWallet(upperWallet, testDid);
      
      // Should retrieve with lowercase
      const retrieved = getDIDForWallet(testWallet.toLowerCase());
      expect(retrieved).toBe(testDid);
    });

    it('should return null for unknown wallet', () => {
      const retrieved = getDIDForWallet('0xunknown000000000000000000000000000000');
      expect(retrieved).toBeNull();
    });

    it('should clear DID for wallet', () => {
      setDIDForWallet(testWallet, testDid);
      clearDIDForWallet(testWallet);
      const retrieved = getDIDForWallet(testWallet);
      expect(retrieved).toBeNull();
    });
  });

  describe('Session Management', () => {
    const testSession = {
      did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      walletAddress: '0x1234567890123456789012345678901234567890',
    };

    it('should store and retrieve session', () => {
      setSession(testSession);
      const retrieved = getSession();
      expect(retrieved).toEqual(testSession);
    });

    it('should return null when no session', () => {
      const retrieved = getSession();
      expect(retrieved).toBeNull();
    });

    it('should clear session', () => {
      setSession(testSession);
      clearSession();
      const retrieved = getSession();
      expect(retrieved).toBeNull();
    });
  });

  describe('AuthError', () => {
    it('should create error with code and message', () => {
      const error = new AuthError('AUTH_INVALID_PASSWORD', 'Invalid password');
      
      expect(error.code).toBe('AUTH_INVALID_PASSWORD');
      expect(error.message).toBe('Invalid password');
      expect(error.name).toBe('AuthError');
    });

    it('should be instance of Error', () => {
      const error = new AuthError('AUTH_TEST', 'Test error');
      expect(error).toBeInstanceOf(Error);
    });
  });
});

describe('Security Requirements', () => {
  it('should NOT store secret keys in localStorage', () => {
    // After any auth operation, localStorage should only contain:
    // - DID-wallet mapping (public info)
    // No secret keys should be present
    
    const localStorageKeys = Object.keys(window.localStorage);
    const hasSecretKey = localStorageKeys.some(key => 
      key.includes('secretKey') || 
      key.includes('privateKey') ||
      key.includes('secret_key') ||
      key.includes('private_key')
    );
    
    expect(hasSecretKey).toBe(false);
  });

  it('should NOT store secret keys in sessionStorage', () => {
    const sessionStorageKeys = Object.keys(window.sessionStorage);
    const hasSecretKey = sessionStorageKeys.some(key => 
      key.includes('secretKey') || 
      key.includes('privateKey') ||
      key.includes('secret_key') ||
      key.includes('private_key')
    );
    
    expect(hasSecretKey).toBe(false);
  });

  it('session should only contain DID and wallet address', () => {
    const session = {
      did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      walletAddress: '0x1234567890123456789012345678901234567890',
    };
    
    setSession(session);
    const stored = window.sessionStorage.getItem('witnesschain:session');
    const parsed = JSON.parse(stored!);
    
    // Should only have these two properties
    expect(Object.keys(parsed)).toEqual(['did', 'walletAddress']);
    expect(parsed).not.toHaveProperty('secretKey');
    expect(parsed).not.toHaveProperty('privateKey');
    expect(parsed).not.toHaveProperty('password');
  });
});

