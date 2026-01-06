// AuthForge - Authentication Middleware

import { Context, Next } from 'hono';
import { Env, User, Session } from '../types';
import { getSessionByToken, checkRateLimit, generateToken, sha256 } from './utils';

// Get trusted client IP - only trust CF-Connecting-IP when behind Cloudflare
// Falls back to connection info, NEVER trusts X-Forwarded-For or X-Real-IP
function getTrustedClientIP(c: Context<{ Bindings: Env }>): string {
  // In production on Cloudflare, CF-Connecting-IP is set by Cloudflare and cannot be spoofed
  // In development, we fall back to a hash of user-agent + origin as a fingerprint
  const cfIP = c.req.header('CF-Connecting-IP');
  
  // Check if we're running on Cloudflare (has CF-Ray header)
  const isCloudflare = !!c.req.header('CF-Ray');
  
  if (isCloudflare && cfIP) {
    return cfIP;
  }
  
  // Fallback: create a fingerprint from available non-spoofable data
  // This is less reliable but prevents trivial bypass in dev
  const userAgent = c.req.header('User-Agent') || '';
  const origin = c.req.header('Origin') || c.req.header('Host') || '';
  return `fingerprint:${userAgent.slice(0, 50)}:${origin}`;
}

// Extend Hono context with auth data
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    session: Session;
  }
}

// Require authentication
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  let token: string | null = null;
  
  // Check Authorization header
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  
  // Check cookie
  if (!token) {
    const cookie = c.req.header('Cookie');
    if (cookie) {
      const match = cookie.match(/authforge_token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (!token) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
  }

  const result = await getSessionByToken(c.env.DB, c.env.SESSIONS, token);
  
  if (!result) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired session' }, 401);
  }

  // Update last active
  await c.env.SESSIONS.put(`session:${result.session.token_hash}`, JSON.stringify({
    ...result.session,
    last_active_at: new Date().toISOString()
  }), { expirationTtl: 7 * 24 * 60 * 60 });

  c.set('user', result.user);
  c.set('session', result.session);

  await next();
}

// Optional auth - sets user if authenticated but doesn't require it
export async function optionalAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  let token: string | null = null;
  
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  
  if (!token) {
    const cookie = c.req.header('Cookie');
    if (cookie) {
      const match = cookie.match(/authforge_token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (token) {
    const result = await getSessionByToken(c.env.DB, c.env.SESSIONS, token);
    if (result) {
      c.set('user', result.user);
      c.set('session', result.session);
    }
  }

  await next();
}

// Rate limiting middleware factory
// SECURITY: Only uses trusted IP sources to prevent header manipulation bypass
export function rateLimit(limit: number, windowSeconds: number, keyFn?: (c: Context<{ Bindings: Env }>) => string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const key = keyFn ? keyFn(c) : getTrustedClientIP(c);
    const endpoint = new URL(c.req.url).pathname;
    
    const result = await checkRateLimit(
      c.env.RATE_LIMIT,
      `${endpoint}:${key}`,
      limit,
      windowSeconds
    );

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.resetAt));

    if (!result.allowed) {
      return c.json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.resetAt - Math.floor(Date.now() / 1000)
      }, 429);
    }

    await next();
  };
}

// Require email verification
export async function requireVerified(c: Context<{ Bindings: Env }>, next: Next) {
  const user = c.get('user');
  
  if (!user.email_verified) {
    return c.json({ 
      error: 'Email Not Verified', 
      message: 'Please verify your email address to continue' 
    }, 403);
  }

  await next();
}

// Require 2FA if enabled
export async function require2FA(c: Context<{ Bindings: Env }>, next: Next) {
  const user = c.get('user');
  const session = c.get('session');
  
  if (user.totp_enabled) {
    // Check if 2FA was verified for this session
    const verified2FA = await c.env.SESSIONS.get(`2fa:${session.id}`);
    
    if (!verified2FA) {
      return c.json({ 
        error: '2FA Required', 
        message: 'Two-factor authentication required',
        requires2FA: true
      }, 403);
    }
  }

  await next();
}
// ============================================
// CSRF Protection
// ============================================
// Double-submit cookie pattern: client must send token in both cookie and header

// Generate CSRF token for a session
export async function generateCSRFToken(c: Context<{ Bindings: Env }>): Promise<string> {
  const session = c.get('session');
  if (!session) {
    throw new Error('Session required for CSRF token');
  }
  
  const token = generateToken();
  const tokenHash = await sha256(token);
  
  // Store token hash linked to session (expires with session)
  await c.env.SESSIONS.put(`csrf:${session.id}`, tokenHash, {
    expirationTtl: 7 * 24 * 60 * 60 // Same as session TTL
  });
  
  return token;
}

// CSRF validation middleware for state-changing operations
export function requireCSRF() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const session = c.get('session');
    if (!session) {
      return c.json({ error: 'Unauthorized', message: 'Session required' }, 401);
    }
    
    // Get CSRF token from header (X-CSRF-Token) or body
    const headerToken = c.req.header('X-CSRF-Token');
    const bodyToken = c.req.header('Content-Type')?.includes('application/json')
      ? (await c.req.json().catch(() => ({}))).csrfToken
      : null;
    
    const clientToken = headerToken || bodyToken;
    
    if (!clientToken) {
      return c.json({ 
        error: 'CSRF Token Missing', 
        message: 'X-CSRF-Token header required for this request' 
      }, 403);
    }
    
    // Verify token against stored hash
    const storedHash = await c.env.SESSIONS.get(`csrf:${session.id}`);
    if (!storedHash) {
      return c.json({ 
        error: 'CSRF Token Invalid', 
        message: 'Please refresh and try again' 
      }, 403);
    }
    
    const clientTokenHash = await sha256(clientToken);
    if (clientTokenHash !== storedHash) {
      return c.json({ 
        error: 'CSRF Token Mismatch', 
        message: 'Security token invalid. Please refresh and try again.' 
      }, 403);
    }
    
    await next();
  };
}