// AuthForge - Core Authentication Routes

import { Hono } from 'hono';
import { Env, User } from '../types';
import { 
  generateId, 
  generateToken,
  hashPassword, 
  verifyPassword, 
  sha256,
  createSession,
  logAudit,
  isValidEmail,
  validatePassword
} from '../lib/utils';
import { requireAuth, rateLimit } from '../lib/middleware';
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';

const auth = new Hono<{ Bindings: Env }>();

// Register with email/password
auth.post('/register', rateLimit(5, 3600), async (c) => {
  const body = await c.req.json<{ email: string; password: string; name?: string }>();
  const { email, password, name } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  if (!isValidEmail(email)) {
    return c.json({ error: 'Invalid email address' }, 400);
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return c.json({ error: 'Password too weak', details: passwordCheck.errors }, 400);
  }

  // Check if user exists
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first();

  if (existing) {
    return c.json({ error: 'An account with this email already exists' }, 409);
  }

  // Create user
  const userId = generateId();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (?, ?, ?, ?)
  `).bind(userId, email.toLowerCase(), name || null, passwordHash).run();

  // Create session
  const user: User = {
    id: userId,
    email: email.toLowerCase(),
    email_verified: 0,
    name: name || null,
    avatar_url: null,
    password_hash: passwordHash,
    totp_secret: null,
    totp_enabled: 0,
    backup_codes: null,
    vault_key: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { session, token } = await createSession(c.env.DB, c.env.SESSIONS, user, c.req.raw);

  await logAudit(c.env.DB, 'user.register', userId, c.req.raw);

  // Set cookie
  c.header('Set-Cookie', `authforge_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

  return c.json({
    success: true,
    message: 'Account created successfully',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: false
    },
    token
  }, 201);
});

// Login with email/password
auth.post('/login', rateLimit(10, 300), async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<User>();

  if (!user || !user.password_hash) {
    await logAudit(c.env.DB, 'user.login.failed', null, c.req.raw, { email, reason: 'not_found' });
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  if (user.status !== 'active') {
    return c.json({ error: 'Account is suspended or deleted' }, 403);
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    await logAudit(c.env.DB, 'user.login.failed', user.id, c.req.raw, { reason: 'invalid_password' });
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Check if 2FA is enabled
  if (user.totp_enabled) {
    // Return a temporary token for 2FA verification
    const tempToken = generateToken();
    await c.env.SESSIONS.put(`2fa_pending:${tempToken}`, user.id, { expirationTtl: 300 });
    
    return c.json({
      success: true,
      requires2FA: true,
      tempToken,
      message: 'Please enter your 2FA code'
    });
  }

  // Create session
  const { session, token } = await createSession(c.env.DB, c.env.SESSIONS, user, c.req.raw);

  await logAudit(c.env.DB, 'user.login', user.id, c.req.raw);

  c.header('Set-Cookie', `authforge_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified === 1,
      has2FA: user.totp_enabled === 1
    },
    token
  });
});

// Verify 2FA code during login
auth.post('/login/2fa', rateLimit(5, 300), async (c) => {
  const body = await c.req.json<{ tempToken: string; code: string }>();
  const { tempToken, code } = body;

  if (!tempToken || !code) {
    return c.json({ error: 'Temp token and code are required' }, 400);
  }

  const userId = await c.env.SESSIONS.get(`2fa_pending:${tempToken}`);
  if (!userId) {
    return c.json({ error: 'Invalid or expired temp token' }, 401);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();

  if (!user || !user.totp_secret) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Verify TOTP
  const totp = new TOTP({ secret: Secret.fromBase32(user.totp_secret) });
  const isValid = totp.validate({ token: code, window: 1 }) !== null;

  if (!isValid) {
    // Check backup codes
    if (user.backup_codes) {
      const codes = JSON.parse(user.backup_codes) as string[];
      const codeHash = await sha256(code);
      const codeIndex = codes.indexOf(codeHash);
      
      if (codeIndex !== -1) {
        // Remove used backup code
        codes.splice(codeIndex, 1);
        await c.env.DB.prepare('UPDATE users SET backup_codes = ? WHERE id = ?')
          .bind(JSON.stringify(codes), user.id)
          .run();
      } else {
        await logAudit(c.env.DB, 'user.2fa.failed', user.id, c.req.raw);
        return c.json({ error: 'Invalid 2FA code' }, 401);
      }
    } else {
      await logAudit(c.env.DB, 'user.2fa.failed', user.id, c.req.raw);
      return c.json({ error: 'Invalid 2FA code' }, 401);
    }
  }

  // Delete temp token
  await c.env.SESSIONS.delete(`2fa_pending:${tempToken}`);

  // Create session
  const { session, token } = await createSession(c.env.DB, c.env.SESSIONS, user, c.req.raw);
  
  // Mark 2FA as verified for this session
  await c.env.SESSIONS.put(`2fa:${session.id}`, '1', { expirationTtl: 7 * 24 * 60 * 60 });

  await logAudit(c.env.DB, 'user.login.2fa', user.id, c.req.raw);

  c.header('Set-Cookie', `authforge_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified === 1,
      has2FA: true
    },
    token
  });
});

// Request magic link
auth.post('/magic-link', rateLimit(3, 300), async (c) => {
  const body = await c.req.json<{ email: string }>();
  const { email } = body;

  if (!email || !isValidEmail(email)) {
    return c.json({ error: 'Valid email is required' }, 400);
  }

  // Always return success to prevent email enumeration
  const response = { success: true, message: 'If an account exists, a magic link has been sent' };

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<{ id: string }>();

  if (!user) {
    return c.json(response);
  }

  // Create magic link token
  const token = generateToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  await c.env.DB.prepare(`
    INSERT INTO magic_links (id, email, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(generateId(), email.toLowerCase(), tokenHash, expiresAt).run();

  // TODO: Send email with magic link
  // For now, log it (in production, integrate with email service)
  console.log(`Magic link for ${email}: /auth/magic-link/verify?token=${token}`);

  await logAudit(c.env.DB, 'user.magic_link.request', user.id, c.req.raw);

  return c.json(response);
});

// Verify magic link
auth.get('/magic-link/verify', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    return c.json({ error: 'Token is required' }, 400);
  }

  const tokenHash = await sha256(token);

  const magicLink = await c.env.DB.prepare(`
    SELECT * FROM magic_links 
    WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')
  `).bind(tokenHash).first<{ id: string; email: string }>();

  if (!magicLink) {
    return c.json({ error: 'Invalid or expired magic link' }, 401);
  }

  // Mark as used
  await c.env.DB.prepare('UPDATE magic_links SET used = 1 WHERE id = ?')
    .bind(magicLink.id)
    .run();

  // Get or create user
  let user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(magicLink.email)
    .first<User>();

  if (!user) {
    const userId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO users (id, email, email_verified)
      VALUES (?, ?, 1)
    `).bind(userId, magicLink.email).run();

    user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first<User>();
  } else {
    // Mark email as verified
    await c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?')
      .bind(user.id)
      .run();
    user.email_verified = 1;
  }

  if (!user) {
    return c.json({ error: 'Failed to create user' }, 500);
  }

  // Create session
  const { session, token: sessionToken } = await createSession(c.env.DB, c.env.SESSIONS, user, c.req.raw);

  await logAudit(c.env.DB, 'user.magic_link.verify', user.id, c.req.raw);

  c.header('Set-Cookie', `authforge_token=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: true
    },
    token: sessionToken
  });
});

// Logout
auth.post('/logout', requireAuth, async (c) => {
  const session = c.get('session');
  const user = c.get('user');

  // Delete session from DB
  await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
    .bind(session.id)
    .run();

  // Delete from KV
  await c.env.SESSIONS.delete(`session:${session.token_hash}`);
  await c.env.SESSIONS.delete(`2fa:${session.id}`);

  await logAudit(c.env.DB, 'user.logout', user.id, c.req.raw);

  c.header('Set-Cookie', 'authforge_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');

  return c.json({ success: true, message: 'Logged out successfully' });
});

// Setup 2FA
auth.post('/2fa/setup', requireAuth, async (c) => {
  const user = c.get('user');

  if (user.totp_enabled) {
    return c.json({ error: '2FA is already enabled' }, 400);
  }

  // Generate secret
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: c.env.WEBAUTHN_RP_NAME || 'AuthForge',
    label: user.email,
    secret
  });

  // Store secret temporarily (not enabled yet)
  await c.env.SESSIONS.put(`2fa_setup:${user.id}`, secret.base32, { expirationTtl: 600 });

  // Generate QR code
  const otpauthUrl = totp.toString();
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  return c.json({
    success: true,
    secret: secret.base32,
    qrCode,
    otpauthUrl
  });
});

// Verify and enable 2FA
auth.post('/2fa/verify', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ code: string }>();
  const { code } = body;

  if (!code) {
    return c.json({ error: 'Code is required' }, 400);
  }

  // Get pending secret
  const secret = await c.env.SESSIONS.get(`2fa_setup:${user.id}`);
  if (!secret) {
    return c.json({ error: 'No 2FA setup in progress. Start with /auth/2fa/setup' }, 400);
  }

  // Verify code
  const totp = new TOTP({ secret: Secret.fromBase32(secret) });
  const isValid = totp.validate({ token: code, window: 1 }) !== null;

  if (!isValid) {
    return c.json({ error: 'Invalid code' }, 401);
  }

  // Generate backup codes
  const backupCodes: string[] = [];
  const backupCodeHashes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = generateToken().substring(0, 8).toUpperCase();
    backupCodes.push(code);
    backupCodeHashes.push(await sha256(code));
  }

  // Enable 2FA
  await c.env.DB.prepare(`
    UPDATE users SET totp_secret = ?, totp_enabled = 1, backup_codes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(secret, JSON.stringify(backupCodeHashes), user.id).run();

  // Clean up
  await c.env.SESSIONS.delete(`2fa_setup:${user.id}`);

  await logAudit(c.env.DB, 'user.2fa.enabled', user.id, c.req.raw);

  return c.json({
    success: true,
    message: '2FA enabled successfully',
    backupCodes // Show these once only!
  });
});

// Disable 2FA
auth.post('/2fa/disable', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ code: string }>();
  const { code } = body;

  if (!user.totp_enabled || !user.totp_secret) {
    return c.json({ error: '2FA is not enabled' }, 400);
  }

  // Verify code
  const totp = new TOTP({ secret: Secret.fromBase32(user.totp_secret) });
  const isValid = totp.validate({ token: code, window: 1 }) !== null;

  if (!isValid) {
    return c.json({ error: 'Invalid code' }, 401);
  }

  // Disable 2FA
  await c.env.DB.prepare(`
    UPDATE users SET totp_secret = NULL, totp_enabled = 0, backup_codes = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).bind(user.id).run();

  await logAudit(c.env.DB, 'user.2fa.disabled', user.id, c.req.raw);

  return c.json({ success: true, message: '2FA disabled successfully' });
});

export { auth as authRoutes };
