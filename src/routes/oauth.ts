// AuthForge - OAuth Routes (Google, GitHub)

import { Hono } from 'hono';
import { Env, User, OAuthAccount } from '../types';
import { 
  generateId, 
  generateToken,
  sha256,
  createSession,
  logAudit 
} from '../lib/utils';
import { rateLimit } from '../lib/middleware';

const oauth = new Hono<{ Bindings: Env }>();

// OAuth state management
interface OAuthState {
  provider: string;
  returnUrl?: string;
  linkToUser?: string; // User ID if linking account
  nonce: string;
}

// Generate OAuth authorization URL
oauth.get('/:provider/authorize', rateLimit(20, 60), async (c) => {
  const provider = c.req.param('provider');
  const returnUrl = c.req.query('returnUrl') || '/';
  const linkToUser = c.req.query('link'); // For account linking

  if (!['google', 'github'].includes(provider)) {
    return c.json({ error: 'Unsupported provider' }, 400);
  }

  // Generate state token
  const state: OAuthState = {
    provider,
    returnUrl,
    linkToUser,
    nonce: generateToken()
  };
  
  const stateToken = generateToken();
  const stateHash = await sha256(stateToken);
  
  await c.env.SESSIONS.put(`oauth_state:${stateHash}`, JSON.stringify(state), {
    expirationTtl: 600 // 10 minutes
  });

  let authUrl: string;

  if (provider === 'google') {
    if (!c.env.GOOGLE_CLIENT_ID) {
      return c.json({ error: 'Google OAuth not configured' }, 500);
    }
    
    const params = new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${c.env.WEBAUTHN_ORIGIN || 'http://localhost:8787'}/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state: stateToken,
      access_type: 'offline',
      prompt: 'select_account'
    });
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  } else if (provider === 'github') {
    if (!c.env.GITHUB_CLIENT_ID) {
      return c.json({ error: 'GitHub OAuth not configured' }, 500);
    }
    
    const params = new URLSearchParams({
      client_id: c.env.GITHUB_CLIENT_ID,
      redirect_uri: `${c.env.WEBAUTHN_ORIGIN || 'http://localhost:8787'}/oauth/github/callback`,
      scope: 'user:email',
      state: stateToken
    });
    authUrl = `https://github.com/login/oauth/authorize?${params}`;
  } else {
    return c.json({ error: 'Provider not supported' }, 400);
  }

  return c.json({ success: true, authUrl });
});

// Google OAuth callback
oauth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const stateToken = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`/login?error=oauth_denied`);
  }

  if (!code || !stateToken) {
    return c.redirect(`/login?error=missing_params`);
  }

  // Verify state
  const stateHash = await sha256(stateToken);
  const stateJson = await c.env.SESSIONS.get(`oauth_state:${stateHash}`);
  
  if (!stateJson) {
    return c.redirect(`/login?error=invalid_state`);
  }

  const state: OAuthState = JSON.parse(stateJson);
  await c.env.SESSIONS.delete(`oauth_state:${stateHash}`);

  if (state.provider !== 'google') {
    return c.redirect(`/login?error=provider_mismatch`);
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID!,
      client_secret: c.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${c.env.WEBAUTHN_ORIGIN}/oauth/google/callback`
    })
  });

  if (!tokenResponse.ok) {
    console.error('Google token error:', await tokenResponse.text());
    return c.redirect(`/login?error=token_exchange_failed`);
  }

  const tokens = await tokenResponse.json<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in: number;
  }>();

  // Get user info
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  if (!userInfoResponse.ok) {
    return c.redirect(`/login?error=userinfo_failed`);
  }

  const googleUser = await userInfoResponse.json<{
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    picture: string;
  }>();

  // Process OAuth login/signup
  return await processOAuthCallback(c, {
    provider: 'google',
    providerId: googleUser.id,
    email: googleUser.email,
    emailVerified: googleUser.verified_email,
    name: googleUser.name,
    avatarUrl: googleUser.picture,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    state
  });
});

// GitHub OAuth callback
oauth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const stateToken = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`/login?error=oauth_denied`);
  }

  if (!code || !stateToken) {
    return c.redirect(`/login?error=missing_params`);
  }

  // Verify state
  const stateHash = await sha256(stateToken);
  const stateJson = await c.env.SESSIONS.get(`oauth_state:${stateHash}`);
  
  if (!stateJson) {
    return c.redirect(`/login?error=invalid_state`);
  }

  const state: OAuthState = JSON.parse(stateJson);
  await c.env.SESSIONS.delete(`oauth_state:${stateHash}`);

  if (state.provider !== 'github') {
    return c.redirect(`/login?error=provider_mismatch`);
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code
    })
  });

  if (!tokenResponse.ok) {
    console.error('GitHub token error:', await tokenResponse.text());
    return c.redirect(`/login?error=token_exchange_failed`);
  }

  const tokens = await tokenResponse.json<{
    access_token: string;
    token_type: string;
    scope: string;
    error?: string;
  }>();

  if (tokens.error) {
    return c.redirect(`/login?error=${tokens.error}`);
  }

  // Get user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { 
      Authorization: `Bearer ${tokens.access_token}`,
      'User-Agent': 'AuthForge'
    }
  });

  if (!userResponse.ok) {
    return c.redirect(`/login?error=userinfo_failed`);
  }

  const githubUser = await userResponse.json<{
    id: number;
    login: string;
    name: string;
    avatar_url: string;
    email: string | null;
  }>();

  // Get email if not public
  let email = githubUser.email;
  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: { 
        Authorization: `Bearer ${tokens.access_token}`,
        'User-Agent': 'AuthForge'
      }
    });

    if (emailsResponse.ok) {
      const emails = await emailsResponse.json<Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>>();
      
      const primaryEmail = emails.find(e => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }
  }

  if (!email) {
    return c.redirect(`/login?error=email_required`);
  }

  // Process OAuth login/signup
  return await processOAuthCallback(c, {
    provider: 'github',
    providerId: String(githubUser.id),
    email,
    emailVerified: true, // GitHub verifies emails
    name: githubUser.name || githubUser.login,
    avatarUrl: githubUser.avatar_url,
    accessToken: tokens.access_token,
    refreshToken: null,
    expiresAt: null, // GitHub tokens don't expire
    state
  });
});

// Process OAuth callback - shared logic
interface OAuthData {
  provider: string;
  providerId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null | undefined;
  expiresAt: string | null;
  state: OAuthState;
}

async function processOAuthCallback(c: any, data: OAuthData) {
  const { provider, providerId, email, emailVerified, name, avatarUrl, accessToken, refreshToken, expiresAt, state } = data;

  // Check if this OAuth account is already linked
  const existingOAuth = await c.env.DB.prepare(`
    SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?
  `).bind(provider, providerId).first<OAuthAccount>();

  let user: User | null = null;

  if (existingOAuth) {
    // User has logged in with this provider before
    user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(existingOAuth.user_id)
      .first<User>();

    if (!user || user.status !== 'active') {
      return c.redirect(`/login?error=account_inactive`);
    }

    // Update OAuth tokens
    await c.env.DB.prepare(`
      UPDATE oauth_accounts 
      SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expires_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(accessToken, refreshToken, expiresAt, existingOAuth.id).run();

  } else if (state.linkToUser) {
    // Linking to existing account
    user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(state.linkToUser)
      .first<User>();

    if (!user) {
      return c.redirect(`/settings?error=user_not_found`);
    }

    // Create OAuth link
    await c.env.DB.prepare(`
      INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(), user.id, provider, providerId, email, accessToken, refreshToken || null, expiresAt
    ).run();

    await logAudit(c.env.DB, `oauth.linked.${provider}`, user.id, c.req.raw);

    return c.redirect(`/settings?success=account_linked`);

  } else {
    // Check if user exists with this email
    user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first<User>();

    if (user) {
      // Link OAuth to existing user
      await c.env.DB.prepare(`
        INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, access_token, refresh_token, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId(), user.id, provider, providerId, email, accessToken, refreshToken || null, expiresAt
      ).run();

      // Update user info if empty
      if (!user.name || !user.avatar_url) {
        await c.env.DB.prepare(`
          UPDATE users SET 
            name = COALESCE(name, ?), 
            avatar_url = COALESCE(avatar_url, ?),
            email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(name, avatarUrl, emailVerified ? 1 : 0, user.id).run();
      }

    } else {
      // Create new user
      const userId = generateId();
      await c.env.DB.prepare(`
        INSERT INTO users (id, email, name, avatar_url, email_verified)
        VALUES (?, ?, ?, ?, ?)
      `).bind(userId, email.toLowerCase(), name, avatarUrl, emailVerified ? 1 : 0).run();

      // Create OAuth link
      await c.env.DB.prepare(`
        INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, access_token, refresh_token, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId(), userId, provider, providerId, email, accessToken, refreshToken || null, expiresAt
      ).run();

      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(userId)
        .first<User>();

      await logAudit(c.env.DB, `user.register.oauth.${provider}`, userId, c.req.raw);
    }
  }

  if (!user) {
    return c.redirect(`/login?error=create_failed`);
  }

  // Create session
  const { session, token } = await createSession(c.env.DB, c.env.SESSIONS, user, c.req.raw);

  await logAudit(c.env.DB, `user.login.oauth.${provider}`, user.id, c.req.raw);

  // Set cookie and redirect
  const returnUrl = state.returnUrl || '/';
  const response = c.redirect(returnUrl);
  response.headers.set('Set-Cookie', `authforge_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
  
  return response;
}

// List linked OAuth accounts (for authenticated user)
oauth.get('/accounts', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || 
                c.req.raw.headers.get('cookie')?.match(/authforge_token=([^;]+)/)?.[1];

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tokenHash = await sha256(token);
  const sessionData = await c.env.SESSIONS.get(`session:${tokenHash}`);
  
  if (!sessionData) {
    return c.json({ error: 'Session expired' }, 401);
  }

  const { userId } = JSON.parse(sessionData);

  const accounts = await c.env.DB.prepare(`
    SELECT id, provider, email, created_at FROM oauth_accounts WHERE user_id = ?
  `).bind(userId).all<OAuthAccount>();

  return c.json({
    success: true,
    accounts: accounts.results.map(a => ({
      id: a.id,
      provider: a.provider,
      email: a.email,
      createdAt: a.created_at
    }))
  });
});

// Unlink OAuth account
oauth.delete('/accounts/:id', async (c) => {
  const accountId = c.req.param('id');
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || 
                c.req.raw.headers.get('cookie')?.match(/authforge_token=([^;]+)/)?.[1];

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tokenHash = await sha256(token);
  const sessionData = await c.env.SESSIONS.get(`session:${tokenHash}`);
  
  if (!sessionData) {
    return c.json({ error: 'Session expired' }, 401);
  }

  const { userId } = JSON.parse(sessionData);

  // Check user has other auth methods
  const user = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(userId)
    .first<{ password_hash: string | null }>();

  const passkeysCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM passkeys WHERE user_id = ?'
  ).bind(userId).first<{ count: number }>();

  const oauthCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM oauth_accounts WHERE user_id = ?'
  ).bind(userId).first<{ count: number }>();

  const hasPassword = user?.password_hash !== null;
  const hasPasskeys = (passkeysCount?.count || 0) > 0;
  const oauthAccountsCount = oauthCount?.count || 0;

  if (!hasPassword && !hasPasskeys && oauthAccountsCount <= 1) {
    return c.json({ 
      error: 'Cannot unlink your only sign-in method' 
    }, 400);
  }

  const result = await c.env.DB.prepare(
    'DELETE FROM oauth_accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, userId).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Account not found' }, 404);
  }

  await logAudit(c.env.DB, 'oauth.unlinked', userId, c.req.raw, { accountId });

  return c.json({ success: true, message: 'Account unlinked' });
});

export { oauth as oauthRoutes };
