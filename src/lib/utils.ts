// AuthForge - Utility Functions

import { nanoid } from 'nanoid';
import * as jose from 'jose';
import { Env, JWTPayload, User, Session } from '../types';

// Generate unique IDs
export const generateId = () => nanoid(21);
export const generateToken = () => nanoid(32);

// Hash functions using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(hash);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);

  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedHashBytes = combined.slice(16);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const hash = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    const hashArray = new Uint8Array(hash);
    
    if (hashArray.length !== storedHashBytes.length) return false;
    
    let match = true;
    for (let i = 0; i < hashArray.length; i++) {
      if (hashArray[i] !== storedHashBytes[i]) match = false;
    }
    return match;
  } catch {
    return false;
  }
}

// Simple SHA-256 hash for tokens
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray));
}

// JWT functions
export async function createJWT(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>, secret: string, expiresIn = '8h'): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  
  const jwt = await new jose.SignJWT({
    ...payload,
    jti: generateId()
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);

  return jwt;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

// Session management
export async function createSession(
  db: D1Database,
  kv: KVNamespace,
  user: User,
  request: Request
): Promise<{ session: Session; token: string }> {
  const token = generateToken();
  const tokenHash = await sha256(token);
  const sessionId = generateId();
  
  const userAgent = request.headers.get('User-Agent') || null;
  const ip = request.headers.get('CF-Connecting-IP') || null;
  
  // Parse device name from user agent
  let deviceName = 'Unknown Device';
  if (userAgent) {
    if (userAgent.includes('Mobile')) deviceName = 'Mobile Device';
    else if (userAgent.includes('Windows')) deviceName = 'Windows PC';
    else if (userAgent.includes('Mac')) deviceName = 'Mac';
    else if (userAgent.includes('Linux')) deviceName = 'Linux';
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const session: Session = {
    id: sessionId,
    user_id: user.id,
    token_hash: tokenHash,
    ip_address: ip,
    user_agent: userAgent,
    device_name: deviceName,
    location: null,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString()
  };

  // Store in D1
  await db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, device_name, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    session.id,
    session.user_id,
    session.token_hash,
    session.ip_address,
    session.user_agent,
    session.device_name,
    session.expires_at
  ).run();

  // Also cache in KV for fast lookups
  await kv.put(`session:${tokenHash}`, JSON.stringify(session), {
    expirationTtl: 7 * 24 * 60 * 60 // 7 days
  });

  return { session, token };
}

export async function getSessionByToken(
  db: D1Database,
  kv: KVNamespace,
  token: string
): Promise<{ session: Session; user: User } | null> {
  const tokenHash = await sha256(token);

  // Check KV cache first
  const cached = await kv.get(`session:${tokenHash}`);
  if (cached) {
    const session = JSON.parse(cached) as Session;
    if (new Date(session.expires_at) < new Date()) {
      await kv.delete(`session:${tokenHash}`);
      return null;
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?')
      .bind(session.user_id)
      .first<User>();

    if (!user || user.status !== 'active') return null;

    return { session, user };
  }

  // Fall back to D1
  const session = await db.prepare('SELECT * FROM sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .first<Session>();

  if (!session || new Date(session.expires_at) < new Date()) {
    return null;
  }

  const user = await db.prepare('SELECT * FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<User>();

  if (!user || user.status !== 'active') return null;

  // Cache for future lookups
  await kv.put(`session:${tokenHash}`, JSON.stringify(session), {
    expirationTtl: 7 * 24 * 60 * 60
  });

  return { session, user };
}

// Rate limiting
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const rateLimitKey = `rate:${key}:${windowStart}`;

  const current = await kv.get(rateLimitKey);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: windowStart + windowSeconds
    };
  }

  await kv.put(rateLimitKey, String(count + 1), {
    expirationTtl: windowSeconds
  });

  return {
    allowed: true,
    remaining: limit - count - 1,
    resetAt: windowStart + windowSeconds
  };
}

// Audit logging
export async function logAudit(
  db: D1Database,
  action: string,
  userId: string | null,
  request: Request,
  details?: Record<string, unknown>
): Promise<void> {
  await db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, ip_address, user_agent, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    generateId(),
    userId,
    action,
    request.headers.get('CF-Connecting-IP'),
    request.headers.get('User-Agent'),
    details ? JSON.stringify(details) : null
  ).run();
}

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password strength validation
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain a special character');

  return { valid: errors.length === 0, errors };
}
