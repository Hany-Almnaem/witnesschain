/**
 * CSRF Protection Middleware
 * 
 * Protects against Cross-Site Request Forgery attacks by:
 * 1. Validating Origin/Referer headers on mutating requests
 * 2. Requiring custom headers that can't be set by simple forms
 * 3. Checking that request comes from allowed origins
 * 
 * Note: Our signature-based auth already provides strong protection,
 * but this adds defense-in-depth for edge cases.
 */

import { Errors } from './error.js';

import type { Context, Next } from 'hono';

/**
 * Get allowed origins from environment or defaults
 */
function getAllowedOrigins(): string[] {
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3001';
  const origins = corsOrigin.split(',').map(o => o.trim().toLowerCase());
  
  // Always allow API origin for server-to-server requests
  const apiPort = process.env.PORT ?? '3000';
  origins.push(`http://localhost:${apiPort}`);
  
  return origins;
}

/**
 * Extract origin from request
 */
function getRequestOrigin(c: Context): string | null {
  // Check Origin header first (set by browsers for CORS requests)
  const origin = c.req.header('origin');
  if (origin) {
    return origin.toLowerCase();
  }
  
  // Fall back to Referer header
  const referer = c.req.header('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin.toLowerCase();
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * CSRF protection middleware
 * 
 * Validates that mutating requests (POST, PUT, PATCH, DELETE)
 * come from allowed origins.
 */
export async function csrfProtection(c: Context, next: Next): Promise<void | Response> {
  const method = c.req.method.toUpperCase();
  
  // Only check mutating requests
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(method)) {
    await next();
    return;
  }
  
  // Skip CSRF check for health endpoints
  const path = c.req.path;
  if (path.startsWith('/api/health')) {
    await next();
    return;
  }
  
  // Get request origin
  const origin = getRequestOrigin(c);
  const allowedOrigins = getAllowedOrigins();
  
  // If no origin, check if request has our custom auth headers
  // (which can't be set by simple forms, providing CSRF protection)
  if (!origin) {
    const hasCustomHeaders = 
      c.req.header('x-did') || 
      c.req.header('x-timestamp') ||
      c.req.header('x-signature');
    
    if (hasCustomHeaders) {
      // Has custom headers - likely a legitimate API request
      await next();
      return;
    }
    
    // For requests without Origin AND without custom headers,
    // require Content-Type that can't be sent by simple forms
    const contentType = c.req.header('content-type') || '';
    const safeContentTypes = [
      'application/json',
      'application/ld+json',
    ];
    
    const isSafeContentType = safeContentTypes.some(
      type => contentType.toLowerCase().startsWith(type)
    );
    
    if (isSafeContentType) {
      await next();
      return;
    }
    
    // No origin, no custom headers, and not a safe content type
    throw Errors.forbidden('Missing origin header for mutating request');
  }
  
  // Validate origin against allowed list
  const isAllowed = allowedOrigins.some(allowed => {
    // Exact match
    if (origin === allowed) return true;
    
    // Handle wildcard subdomains (e.g., *.witnesschain.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin === `https://${domain}` || origin === `http://${domain}`;
    }
    
    return false;
  });
  
  if (!isAllowed) {
    console.warn(`CSRF: Blocked request from origin ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
    throw Errors.forbidden('Request origin not allowed');
  }
  
  await next();
}

/**
 * Strict CSRF middleware that also validates Sec-Fetch-* headers
 * For browsers that support Fetch Metadata
 */
export async function strictCsrfProtection(c: Context, next: Next): Promise<void | Response> {
  const method = c.req.method.toUpperCase();
  
  // Only check mutating requests
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(method)) {
    await next();
    return;
  }
  
  // Check Sec-Fetch-Site header if present (modern browsers)
  const fetchSite = c.req.header('sec-fetch-site');
  if (fetchSite) {
    // Allow same-origin and same-site requests
    const allowedFetchSites = ['same-origin', 'same-site', 'none'];
    if (!allowedFetchSites.includes(fetchSite)) {
      console.warn(`CSRF: Blocked cross-site fetch request. Sec-Fetch-Site: ${fetchSite}`);
      throw Errors.forbidden('Cross-site requests not allowed');
    }
  }
  
  // Continue with regular CSRF protection
  await csrfProtection(c, next);
}

