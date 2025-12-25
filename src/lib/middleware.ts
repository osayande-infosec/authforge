// AuthForge - Authentication Middleware

import { Context, Next } from 'hono';
import { Env, User, Session } from '../types';
import { getSessionByToken, checkRateLimit } from './utils';

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
export function rateLimit(limit: number, windowSeconds: number, keyFn?: (c: Context) => string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const key = keyFn ? keyFn(c) : (c.req.header('CF-Connecting-IP') || 'anonymous');
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
