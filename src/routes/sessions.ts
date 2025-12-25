// AuthForge - Sessions Management Routes

import { Hono } from 'hono';
import { Env, Session } from '../types';
import { sha256, logAudit } from '../lib/utils';
import { requireAuth } from '../lib/middleware';

const sessions = new Hono<{ Bindings: Env }>();

// List all sessions for current user
sessions.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const currentSession = c.get('session');

  const result = await c.env.DB.prepare(`
    SELECT id, device_info, ip_address, last_active_at, created_at
    FROM sessions 
    WHERE user_id = ? AND expires_at > datetime('now')
    ORDER BY last_active_at DESC
  `).bind(user.id).all<Session>();

  const sessionsData = result.results.map(s => {
    let deviceInfo = { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
    if (s.device_info) {
      try {
        deviceInfo = JSON.parse(s.device_info);
      } catch {}
    }

    return {
      id: s.id,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device: deviceInfo.device,
      ipAddress: s.ip_address,
      lastActiveAt: s.last_active_at,
      createdAt: s.created_at,
      isCurrent: s.id === currentSession.id
    };
  });

  return c.json({
    success: true,
    sessions: sessionsData,
    currentSessionId: currentSession.id
  });
});

// Revoke a specific session
sessions.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const currentSession = c.get('session');
  const sessionId = c.req.param('id');

  if (sessionId === currentSession.id) {
    return c.json({ error: 'Cannot revoke current session. Use /auth/logout instead.' }, 400);
  }

  // Get session to delete from KV
  const sessionToDelete = await c.env.DB.prepare(`
    SELECT token_hash FROM sessions WHERE id = ? AND user_id = ?
  `).bind(sessionId, user.id).first<{ token_hash: string }>();

  if (!sessionToDelete) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Delete from DB
  await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
    .bind(sessionId)
    .run();

  // Delete from KV
  await c.env.SESSIONS.delete(`session:${sessionToDelete.token_hash}`);

  await logAudit(c.env.DB, 'session.revoked', user.id, c.req.raw, { sessionId });

  return c.json({ success: true, message: 'Session revoked' });
});

// Revoke all sessions except current
sessions.post('/revoke-all', requireAuth, async (c) => {
  const user = c.get('user');
  const currentSession = c.get('session');

  // Get all sessions to delete
  const sessionsToDelete = await c.env.DB.prepare(`
    SELECT id, token_hash FROM sessions WHERE user_id = ? AND id != ?
  `).bind(user.id, currentSession.id).all<{ id: string; token_hash: string }>();

  // Delete from KV
  for (const session of sessionsToDelete.results) {
    await c.env.SESSIONS.delete(`session:${session.token_hash}`);
  }

  // Delete from DB
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?')
    .bind(user.id, currentSession.id)
    .run();

  await logAudit(c.env.DB, 'sessions.revoked_all', user.id, c.req.raw, { 
    count: sessionsToDelete.results.length 
  });

  return c.json({ 
    success: true, 
    message: `Revoked ${sessionsToDelete.results.length} sessions` 
  });
});

// Get current session info
sessions.get('/current', requireAuth, async (c) => {
  const session = c.get('session');
  const user = c.get('user');

  let deviceInfo = { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  if (session.device_info) {
    try {
      deviceInfo = JSON.parse(session.device_info);
    } catch {}
  }

  // Check 2FA status for this session
  const is2FAVerified = await c.env.SESSIONS.get(`2fa:${session.id}`);

  return c.json({
    success: true,
    session: {
      id: session.id,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device: deviceInfo.device,
      ipAddress: session.ip_address,
      lastActiveAt: session.last_active_at,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      is2FAVerified: is2FAVerified === '1'
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified === 1,
      has2FA: user.totp_enabled === 1,
      avatarUrl: user.avatar_url
    }
  });
});

export { sessions as sessionsRoutes };
