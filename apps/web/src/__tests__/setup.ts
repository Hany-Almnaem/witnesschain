/**
 * Vitest Test Setup
 * 
 * Sets up real cryptography and IndexedDB for testing.
 * Uses fake-indexeddb for IndexedDB operations.
 * Relies on Node.js 20+ globalThis.crypto or jsdom's crypto.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// In Node.js 20+, crypto is available globally
// In jsdom, it should also be available
// Only polyfill if not present
if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.subtle === 'undefined') {
  // Dynamically import for Node.js environments that don't have global crypto
  const { webcrypto } = await import('node:crypto');
Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  writable: true,
});
}

// Mock localStorage (simple key-value storage, doesn't need real implementation)
const localStorageMock = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => localStorageMock.store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageMock.store.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageMock.store.clear();
  }),
  get length() {
    return localStorageMock.store.size;
  },
  key: vi.fn((index: number) => {
    const keys = Array.from(localStorageMock.store.keys());
    return keys[index] ?? null;
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Also set on window for browser-like environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

// Mock sessionStorage (simple key-value storage, doesn't need real implementation)
const sessionStorageMock = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => sessionStorageMock.store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    sessionStorageMock.store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    sessionStorageMock.store.delete(key);
  }),
  clear: vi.fn(() => {
    sessionStorageMock.store.clear();
  }),
  get length() {
    return sessionStorageMock.store.size;
  },
  key: vi.fn((index: number) => {
    const keys = Array.from(sessionStorageMock.store.keys());
    return keys[index] ?? null;
  }),
};

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
  });
}

// Clear stores between tests
beforeEach(() => {
  localStorageMock.store.clear();
  sessionStorageMock.store.clear();
  vi.clearAllMocks();
});

// Clean up IndexedDB after each test
afterEach(async () => {
  // Delete all databases to ensure clean state
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) {
      indexedDB.deleteDatabase(db.name);
    }
  }
});
