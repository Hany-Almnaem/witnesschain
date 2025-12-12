/**
 * Vitest Test Setup
 * 
 * Sets up mocks and globals for testing.
 */

import { vi, beforeEach } from 'vitest';

// Mock Web Crypto API
const mockCrypto = {
  getRandomValues: <T extends ArrayBufferView>(array: T): T => {
    const uint8 = array as unknown as Uint8Array;
    for (let i = 0; i < uint8.length; i++) {
      uint8[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    importKey: vi.fn().mockResolvedValue({}),
    deriveKey: vi.fn().mockResolvedValue({}),
    encrypt: vi.fn().mockImplementation(async (_: unknown, __: unknown, data: ArrayBuffer) => {
      const input = new Uint8Array(data);
      const output = new Uint8Array(input.length + 16);
      output.set(input);
      return output.buffer;
    }),
    decrypt: vi.fn().mockImplementation(async (_: unknown, __: unknown, data: ArrayBuffer) => {
      const input = new Uint8Array(data);
      const output = new Uint8Array(input.length - 16);
      for (let i = 0; i < output.length; i++) {
        output[i] = input[i];
      }
      return output.buffer;
    }),
    digest: vi.fn().mockImplementation(async (_: unknown, data: ArrayBuffer) => {
      const hash = new Uint8Array(32);
      const input = new Uint8Array(data);
      for (let i = 0; i < 32; i++) {
        hash[i] = input[i % input.length] ^ (i * 17);
      }
      return hash.buffer;
    }),
  },
};

Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true,
});

// Mock IndexedDB
const mockIndexedDB = {
  databases: new Map<string, Map<string, unknown>>(),
  open: vi.fn().mockImplementation((name: string) => {
    const db = {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(true),
      },
      createObjectStore: vi.fn(),
      transaction: vi.fn().mockImplementation((storeName: string) => {
        const store = mockIndexedDB.databases.get(name) ?? new Map();
        mockIndexedDB.databases.set(name, store);

        return {
          objectStore: vi.fn().mockReturnValue({
            put: vi.fn().mockImplementation((value: unknown, key: string) => {
              store.set(key, value);
              return { onerror: null, onsuccess: null };
            }),
            get: vi.fn().mockImplementation((key: string) => {
              return { 
                result: store.get(key),
                onerror: null, 
                onsuccess: null 
              };
            }),
            delete: vi.fn().mockImplementation((key: string) => {
              store.delete(key);
              return { onerror: null, onsuccess: null };
            }),
            getAllKeys: vi.fn().mockImplementation(() => ({
              result: Array.from(store.keys()),
              onerror: null,
              onsuccess: null,
            })),
            clear: vi.fn().mockImplementation(() => {
              store.clear();
              return { onerror: null, onsuccess: null };
            }),
          }),
          oncomplete: null,
        };
      }),
      close: vi.fn(),
    };

    const request = {
      result: db,
      error: null,
      onerror: null as ((e: Event) => void) | null,
      onsuccess: null as ((e: Event) => void) | null,
      onupgradeneeded: null as ((e: Event) => void) | null,
    };

    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess(new Event('success'));
      }
    }, 0);

    return request;
  }),
};

Object.defineProperty(globalThis, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock localStorage
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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
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

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Clear stores between tests
beforeEach(() => {
  localStorageMock.store.clear();
  sessionStorageMock.store.clear();
  mockIndexedDB.databases.clear();
  vi.clearAllMocks();
});
