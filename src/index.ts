// AuthForge - Self-hosted Authentication Platform
// Main entry point for Cloudflare Workers

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';

import { authRoutes } from './routes/auth';
import { passkeysRoutes } from './routes/passkeys';
import { oauthRoutes } from './routes/oauth';
import { sessionsRoutes } from './routes/sessions';
import { vaultRoutes } from './routes/vault';
import { usersRoutes } from './routes/users';
import { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin, c) => {
    const allowed = c.env.ALLOWED_ORIGINS?.split(',') || [];
    if (!origin || allowed.includes(origin) || allowed.includes('*')) {
      return origin || '*';
    }
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'AuthForge',
    version: '1.0.0',
    status: 'healthy',
    docs: '/docs',
    timestamp: new Date().toISOString()
  });
});

// API documentation
app.get('/docs', (c) => {
  return c.json({
    name: 'AuthForge API',
    version: '1.0.0',
    description: 'Self-hosted authentication platform with Passkeys, OAuth, Magic Links & Encrypted Vault',
    endpoints: {
      auth: {
        'POST /auth/register': 'Register with email/password',
        'POST /auth/login': 'Login with email/password',
        'POST /auth/magic-link': 'Request magic link',
        'GET /auth/magic-link/verify': 'Verify magic link',
        'POST /auth/logout': 'Logout current session',
        'POST /auth/2fa/setup': 'Setup TOTP 2FA',
        'POST /auth/2fa/verify': 'Verify TOTP code',
        'POST /auth/2fa/disable': 'Disable 2FA',
      },
      passkeys: {
        'POST /passkeys/register/options': 'Get registration options',
        'POST /passkeys/register/verify': 'Verify and save passkey',
        'POST /passkeys/login/options': 'Get authentication options',
        'POST /passkeys/login/verify': 'Verify passkey login',
        'GET /passkeys': 'List user passkeys',
        'DELETE /passkeys/:id': 'Remove a passkey',
      },
      oauth: {
        'GET /oauth/google': 'Initiate Google OAuth',
        'GET /oauth/google/callback': 'Google OAuth callback',
        'GET /oauth/github': 'Initiate GitHub OAuth',
        'GET /oauth/github/callback': 'GitHub OAuth callback',
      },
      sessions: {
        'GET /sessions': 'List active sessions',
        'DELETE /sessions/:id': 'Revoke a session',
        'DELETE /sessions': 'Revoke all other sessions',
      },
      vault: {
        'GET /vault/items': 'List vault items',
        'POST /vault/items': 'Create vault item',
        'GET /vault/items/:id': 'Get vault item',
        'PUT /vault/items/:id': 'Update vault item',
        'DELETE /vault/items/:id': 'Delete vault item',
        'GET /vault/folders': 'List folders',
        'POST /vault/folders': 'Create folder',
      },
      users: {
        'GET /users/me': 'Get current user',
        'PUT /users/me': 'Update profile',
        'DELETE /users/me': 'Delete account',
        'GET /users/audit-log': 'Get audit log',
      }
    }
  });
});

// Mount routes
app.route('/auth', authRoutes);
app.route('/passkeys', passkeysRoutes);
app.route('/oauth', oauthRoutes);
app.route('/sessions', sessionsRoutes);
app.route('/vault', vaultRoutes);
app.route('/users', usersRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', message: 'The requested endpoint does not exist' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ 
    error: 'Internal Server Error', 
    message: c.env.ENVIRONMENT === 'production' ? 'Something went wrong' : err.message 
  }, 500);
});

export default app;
