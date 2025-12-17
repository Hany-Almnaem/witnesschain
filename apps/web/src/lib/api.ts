/**
 * API Client Utilities
 * 
 * Provides authenticated fetch wrapper that automatically
 * adds auth headers from the current session.
 */

import { getSession } from './auth';
import { getApiUrl } from './env';

/**
 * Create auth headers from current session
 * Returns empty object if no session exists
 */
export function getAuthHeaders(): Record<string, string> {
  const session = getSession();
  
  if (!session) {
    return {};
  }
  
  return {
    'X-DID': session.did,
    'X-Wallet-Address': session.walletAddress,
  };
}

/**
 * Authenticated fetch wrapper
 * Automatically adds auth headers from session
 */
export async function authFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiUrl = getApiUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${apiUrl}${endpoint}`;
  
  const authHeaders = getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
  
  return response;
}

/**
 * Authenticated JSON fetch wrapper
 * Automatically adds auth headers and Content-Type
 */
export async function authFetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const response = await authFetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  try {
    const data = await response.json();
    
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.message || data.error || 'Request failed',
      };
    }
    
    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch {
    return {
      ok: false,
      status: response.status,
      error: 'Failed to parse response',
    };
  }
}

