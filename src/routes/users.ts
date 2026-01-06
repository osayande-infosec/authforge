// AuthForge - User Profile & Settings Routes

import { Hono } from 'hono';
import { Env, User, AuditLog } from '../types';
import { generateId, hashPassword, verifyPassword, isValidEmail, validatePassword, logAudit } from '../lib/utils';
import { requireAuth, rateLimit, requireCSRF } from '../lib/middleware';
import { createEmailService } from '../lib/email';

const users = new Hono<{ Bindings: Env }>();

// Get current user profile
users.get('/me', requireAuth, async (c) => {
  const user = c.get('user');

  // Get auth methods
  const passkeysCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM passkeys WHERE user_id = ?'
  ).bind(user.id).first<{ count: number }>();

  const oauthAccounts = await c.env.DB.prepare(
    'SELECT provider FROM oauth_accounts WHERE user_id = ?'
  ).bind(user.id).all<{ provider: string }>();

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      emailVerified: user.email_verified === 1,
      has2FA: user.totp_enabled === 1,
      hasPassword: user.password_hash !== null,
      hasVault: user.vault_key !== null,
      status: user.status,
      createdAt: user.created_at,
      authMethods: {
        password: user.password_hash !== null,
        passkeys: passkeysCount?.count || 0,
        oauth: oauthAccounts.results.map(a => a.provider)
      }
    }
  });
});

// Update profile
users.patch('/me', requireAuth, requireCSRF(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ name?: string; avatarUrl?: string }>();

  const updates: string[] = [];
  const params: any[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    params.push(body.name || null);
  }

  if (body.avatarUrl !== undefined) {
    updates.push('avatar_url = ?');
    params.push(body.avatarUrl || null);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push('updated_at = datetime(\'now\')');

  await c.env.DB.prepare(`
    UPDATE users SET ${updates.join(', ')} WHERE id = ?
  `).bind(...params, user.id).run();

  await logAudit(c.env.DB, 'user.profile.updated', user.id, c.req.raw);

  return c.json({ success: true, message: 'Profile updated' });
});

// Change email
users.post('/me/email', requireAuth, requireCSRF(), rateLimit(3, 3600), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ newEmail: string; password?: string }>();

  if (!body.newEmail || !isValidEmail(body.newEmail)) {
    return c.json({ error: 'Valid email is required' }, 400);
  }

  // If user has password, require it for email change
  if (user.password_hash) {
    if (!body.password) {
      return c.json({ error: 'Current password is required' }, 400);
    }

    const validPassword = await verifyPassword(body.password, user.password_hash);
    if (!validPassword) {
      return c.json({ error: 'Invalid password' }, 401);
    }
  }

  // Check if email is taken
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.newEmail.toLowerCase())
    .first();

  if (existing) {
    return c.json({ error: 'Email is already in use' }, 409);
  }

  // Update email (mark as unverified)
  await c.env.DB.prepare(`
    UPDATE users SET email = ?, email_verified = 0, updated_at = datetime('now')
    WHERE id = ?
  `).bind(body.newEmail.toLowerCase(), user.id).run();

  await logAudit(c.env.DB, 'user.email.changed', user.id, c.req.raw, { 
    oldEmail: user.email,
    newEmail: body.newEmail.toLowerCase()
  });

  // TODO: Send verification email

  return c.json({ success: true, message: 'Email updated. Please verify your new email.' });
});

// Set or change password
users.post('/me/password', requireAuth, requireCSRF(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ currentPassword?: string; newPassword: string }>();

  if (!body.newPassword) {
    return c.json({ error: 'New password is required' }, 400);
  }

  // If user already has password, require current password
  if (user.password_hash) {
    if (!body.currentPassword) {
      return c.json({ error: 'Current password is required' }, 400);
    }

    const validPassword = await verifyPassword(body.currentPassword, user.password_hash);
    if (!validPassword) {
      return c.json({ error: 'Invalid current password' }, 401);
    }
  }

  const passwordCheck = validatePassword(body.newPassword);
  if (!passwordCheck.valid) {
    return c.json({ error: 'Password too weak', details: passwordCheck.errors }, 400);
  }

  const newHash = await hashPassword(body.newPassword);

  await c.env.DB.prepare(`
    UPDATE users SET password_hash = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(newHash, user.id).run();

  await logAudit(c.env.DB, 'user.password.changed', user.id, c.req.raw);

  return c.json({ success: true, message: 'Password updated' });
});

// Request password reset (for users who forgot password)
users.post('/password-reset', rateLimit(3, 300), async (c) => {
  const body = await c.req.json<{ email: string }>();

  if (!body.email || !isValidEmail(body.email)) {
    return c.json({ error: 'Valid email is required' }, 400);
  }

  // Always return success to prevent email enumeration
  const response = { success: true, message: 'If an account exists, a password reset link has been sent' };

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email.toLowerCase())
    .first<{ id: string }>();

  if (!user) {
    return c.json(response);
  }

  // Create reset token
  const token = generateId() + generateId(); // 40 chars
  const tokenHash = await (async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  })();

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  await c.env.DB.prepare(`
    INSERT INTO password_resets (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(generateId(), user.id, tokenHash, expiresAt).run();

  // TODO: Send email with reset link
  console.log(`Password reset for ${body.email}: /reset-password?token=${token}`);

  await logAudit(c.env.DB, 'user.password_reset.requested', user.id, c.req.raw);

  return c.json(response);
});

// Complete password reset
users.post('/password-reset/complete', rateLimit(5, 300), async (c) => {
  const body = await c.req.json<{ token: string; newPassword: string }>();

  if (!body.token || !body.newPassword) {
    return c.json({ error: 'Token and new password are required' }, 400);
  }

  const tokenHash = await (async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(body.token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  })();

  const reset = await c.env.DB.prepare(`
    SELECT * FROM password_resets 
    WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')
  `).bind(tokenHash).first<{ id: string; user_id: string }>();

  if (!reset) {
    return c.json({ error: 'Invalid or expired reset token' }, 401);
  }

  const passwordCheck = validatePassword(body.newPassword);
  if (!passwordCheck.valid) {
    return c.json({ error: 'Password too weak', details: passwordCheck.errors }, 400);
  }

  const newHash = await hashPassword(body.newPassword);

  // Update password
  await c.env.DB.prepare(`
    UPDATE users SET password_hash = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(newHash, reset.user_id).run();

  // Mark token as used
  await c.env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?')
    .bind(reset.id)
    .run();

  await logAudit(c.env.DB, 'user.password_reset.completed', reset.user_id, c.req.raw);

  return c.json({ success: true, message: 'Password has been reset. You can now log in.' });
});

// Get audit log
users.get('/me/audit-log', requireAuth, async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  const result = await c.env.DB.prepare(`
    SELECT * FROM audit_logs 
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(user.id, limit, offset).all<AuditLog>();

  const total = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ?'
  ).bind(user.id).first<{ count: number }>();

  return c.json({
    success: true,
    logs: result.results.map(log => ({
      id: log.id,
      action: log.action,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      createdAt: log.created_at
    })),
    pagination: {
      total: total?.count || 0,
      limit,
      offset
    }
  });
});

// Delete account
users.delete('/me', requireAuth, requireCSRF(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ password?: string; confirmation: string }>();

  if (body.confirmation !== 'DELETE MY ACCOUNT') {
    return c.json({ error: 'Please confirm by typing "DELETE MY ACCOUNT"' }, 400);
  }

  // If user has password, require it
  if (user.password_hash) {
    if (!body.password) {
      return c.json({ error: 'Password is required' }, 400);
    }

    const validPassword = await verifyPassword(body.password, user.password_hash);
    if (!validPassword) {
      return c.json({ error: 'Invalid password' }, 401);
    }
  }

  // Soft delete - mark as deleted
  await c.env.DB.prepare(`
    UPDATE users SET status = 'deleted', email = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(`deleted_${user.id}@deleted.local`, user.id).run();

  // Revoke all sessions
  const sessions = await c.env.DB.prepare(
    'SELECT token_hash FROM sessions WHERE user_id = ?'
  ).bind(user.id).all<{ token_hash: string }>();

  for (const session of sessions.results) {
    await c.env.SESSIONS.delete(`session:${session.token_hash}`);
  }

  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();

  // Delete auth methods
  await c.env.DB.prepare('DELETE FROM passkeys WHERE user_id = ?').bind(user.id).run();
  await c.env.DB.prepare('DELETE FROM oauth_accounts WHERE user_id = ?').bind(user.id).run();

  // Delete vault
  await c.env.DB.prepare('DELETE FROM vault_items WHERE user_id = ?').bind(user.id).run();
  await c.env.DB.prepare('DELETE FROM vault_folders WHERE user_id = ?').bind(user.id).run();

  await logAudit(c.env.DB, 'user.deleted', user.id, c.req.raw);

  c.header('Set-Cookie', 'authforge_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');

  return c.json({ success: true, message: 'Account deleted' });
});

// Request email verification - sends verification link
users.post('/me/verify-email', requireAuth, rateLimit(3, 300), async (c) => {
  const user = c.get('user');

  if (user.email_verified) {
    return c.json({ error: 'Email is already verified' }, 400);
  }

  // Create verification token (reuse magic link table)
  const token = generateId() + generateId();
  const tokenHash = await (async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  })();

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  await c.env.DB.prepare(`
    INSERT INTO magic_links (id, email, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(generateId(), user.email, tokenHash, expiresAt).run();

  // Build verification URL - use the current request's origin for the API endpoint
  const requestUrl = new URL(c.req.url);
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
  const verifyUrl = `${baseUrl}/users/verify-email?token=${token}`;

  // Send email via Resend
  const emailService = createEmailService(c.env);
  if (emailService) {
    const result = await emailService.sendVerificationEmail(user.email, verifyUrl);
    if (!result.success) {
      console.error('Failed to send verification email:', result.error);
      // Don't fail the request - token is created, they can retry
      return c.json({ 
        success: true, 
        message: 'Verification email queued. If not received, please try again.',
        warning: 'Email delivery may be delayed'
      });
    }
    await logAudit(c.env.DB, 'user.verification_email.sent', user.id, c.req.raw);
  } else {
    // Development mode - log the link
    console.log(`[DEV] Verification link for ${user.email}: ${verifyUrl}`);
    return c.json({ 
      success: true, 
      message: 'Email service not configured. Check server logs for verification link.',
      devMode: true
    });
  }

  return c.json({ success: true, message: 'Verification email sent. Please check your inbox.' });
});

// Verify email with token (from email link)
users.get('/verify-email', rateLimit(10, 300), async (c) => {
  const token = c.req.query('token');
  
  if (!token) {
    return c.json({ error: 'Verification token is required' }, 400);
  }

  // Hash the token to compare with stored hash
  const tokenHash = await (async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  })();

  // Find valid verification record
  const record = await c.env.DB.prepare(`
    SELECT id, email, expires_at, used FROM magic_links 
    WHERE token_hash = ? AND used = 0
  `).bind(tokenHash).first<{ id: string; email: string; expires_at: string; used: number }>();

  if (!record) {
    return c.json({ error: 'Invalid or expired verification link' }, 400);
  }

  // Check expiration
  if (new Date(record.expires_at) < new Date()) {
    return c.json({ error: 'Verification link has expired. Please request a new one.' }, 400);
  }

  // Find user by email
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(record.email)
    .first<{ id: string }>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Mark email as verified
  await c.env.DB.prepare(`
    UPDATE users SET email_verified = 1, updated_at = datetime('now')
    WHERE id = ?
  `).bind(user.id).run();

  // Mark token as used
  await c.env.DB.prepare(`
    UPDATE magic_links SET used = 1 WHERE id = ?
  `).bind(record.id).run();

  await logAudit(c.env.DB, 'user.email.verified', user.id, c.req.raw);

  // Redirect to frontend with success
  const frontendUrl = c.env.ALLOWED_ORIGINS?.split(',')[0] || 'http://localhost:5173';
  return c.redirect(`${frontendUrl}/login?verified=true`);
});

// Demo: Instant email verification (for demo/development only)
// SECURITY: This endpoint is disabled in production - use /me/verify-email for proper flow
users.post('/me/verify-email-demo', requireAuth, async (c) => {
  // Block in production
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({ 
      error: 'Not Available', 
      message: 'Demo verification is disabled in production. Use email verification link.' 
    }, 403);
  }

  const user = c.get('user');

  if (user.email_verified) {
    return c.json({ error: 'Email is already verified' }, 400);
  }

  // Directly mark email as verified (demo mode only)
  await c.env.DB.prepare(`
    UPDATE users SET email_verified = 1, updated_at = datetime('now')
    WHERE id = ?
  `).bind(user.id).run();

  await logAudit(c.env.DB, 'user.email.verified.demo', user.id, c.req.raw);

  return c.json({ success: true, message: 'Email verified (demo mode - development only)' });
});

export { users as usersRoutes };
