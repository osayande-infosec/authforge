// AuthForge - OpenID Connect (OIDC) Routes
// Enables enterprise SSO integration with any OIDC-compatible application

import { Hono } from 'hono';
import { Env, User } from '../types';
import { generateId, verifyPassword } from '../lib/utils';
import { requireAuth } from '../lib/middleware';
import { sign, verify } from 'hono/jwt';

const oidc = new Hono<{ Bindings: Env }>();

// Helper to get the issuer URL
const getIssuer = (c: any) => {
  const origin = c.req.header('origin') || c.req.header('host') || 'localhost:8787';
  const protocol = origin.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${origin.replace(/^https?:\/\//, '')}`;
};

// ============================================
// OIDC Discovery Endpoint
// ============================================
// This is the magic endpoint that allows any app to auto-configure
// GET /.well-known/openid-configuration

oidc.get('/.well-known/openid-configuration', (c) => {
  const issuer = getIssuer(c);
  
  return c.json({
    // Required fields
    issuer,
    authorization_endpoint: `${issuer}/api/oidc/authorize`,
    token_endpoint: `${issuer}/api/oidc/token`,
    userinfo_endpoint: `${issuer}/api/oidc/userinfo`,
    jwks_uri: `${issuer}/api/oidc/jwks`,
    
    // Supported features
    response_types_supported: ['code', 'token', 'id_token', 'code token', 'code id_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256', 'RS256'],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    claims_supported: [
      'sub', 'iss', 'aud', 'exp', 'iat', 'name', 'email', 'email_verified', 'picture'
    ],
    
    // Optional endpoints
    revocation_endpoint: `${issuer}/api/oidc/revoke`,
    introspection_endpoint: `${issuer}/api/oidc/introspect`,
    end_session_endpoint: `${issuer}/api/oidc/logout`,
    
    // PKCE support (recommended for public clients)
    code_challenge_methods_supported: ['S256', 'plain'],
    
    // Grant types
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    
    // Additional metadata
    service_documentation: `${issuer}/docs`,
    ui_locales_supported: ['en'],
    op_policy_uri: `${issuer}/privacy`,
    op_tos_uri: `${issuer}/terms`
  });
});

// ============================================
// JWKS Endpoint (JSON Web Key Set)
// ============================================
// Returns public keys for token verification

oidc.get('/jwks', async (c) => {
  // In production, you'd generate and store RSA keys
  // For now, we return a placeholder indicating HS256 is used
  return c.json({
    keys: [
      {
        kty: 'oct',
        alg: 'HS256',
        use: 'sig',
        kid: 'authforge-key-1'
      }
    ]
  });
});

// ============================================
// Authorization Endpoint
// ============================================
// Initiates the OAuth2/OIDC flow

oidc.get('/authorize', async (c) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    nonce,
    code_challenge,
    code_challenge_method
  } = c.req.query();

  // Validate required params
  if (!client_id || !redirect_uri || !response_type) {
    return c.json({ 
      error: 'invalid_request',
      error_description: 'Missing required parameters: client_id, redirect_uri, response_type'
    }, 400);
  }

  // Validate client (in production, check against registered clients)
  const client = await c.env.DB.prepare(
    'SELECT * FROM oauth_clients WHERE client_id = ? AND status = ?'
  ).bind(client_id, 'active').first();

  if (!client) {
    return c.json({ 
      error: 'invalid_client',
      error_description: 'Unknown or inactive client'
    }, 401);
  }

  // Store authorization request for the login flow
  const authRequestId = generateId();
  await c.env.SESSIONS.put(`oidc_auth:${authRequestId}`, JSON.stringify({
    client_id,
    redirect_uri,
    response_type,
    scope: scope || 'openid',
    state,
    nonce,
    code_challenge,
    code_challenge_method,
    created_at: Date.now()
  }), { expirationTtl: 600 }); // 10 minutes

  // Redirect to login page with auth request ID
  const loginUrl = new URL('/login', c.req.url);
  loginUrl.searchParams.set('oidc_request', authRequestId);
  
  return c.redirect(loginUrl.toString());
});

// ============================================
// Token Endpoint
// ============================================
// Exchanges authorization code for tokens

oidc.post('/token', async (c) => {
  const body = await c.req.parseBody();
  const grant_type = body.grant_type as string;
  
  if (grant_type === 'authorization_code') {
    const code = body.code as string;
    const redirect_uri = body.redirect_uri as string;
    const client_id = body.client_id as string;
    const client_secret = body.client_secret as string;
    const code_verifier = body.code_verifier as string;

    // Retrieve stored authorization code
    const storedCode = await c.env.SESSIONS.get(`oidc_code:${code}`);
    if (!storedCode) {
      return c.json({ error: 'invalid_grant', error_description: 'Invalid or expired code' }, 400);
    }

    const codeData = JSON.parse(storedCode);
    
    // Validate redirect_uri matches
    if (codeData.redirect_uri !== redirect_uri) {
      return c.json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }, 400);
    }

    // Validate PKCE if used
    if (codeData.code_challenge) {
      if (!code_verifier) {
        return c.json({ error: 'invalid_grant', error_description: 'Code verifier required' }, 400);
      }
      // Verify code_challenge matches hash of code_verifier
      const encoder = new TextEncoder();
      const data = encoder.encode(code_verifier);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedChallenge = btoa(String.fromCharCode(...hashArray))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      if (calculatedChallenge !== codeData.code_challenge) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid code verifier' }, 400);
      }
    }

    // Delete used code
    await c.env.SESSIONS.delete(`oidc_code:${code}`);

    // Get user
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(codeData.user_id).first<User>();

    if (!user) {
      return c.json({ error: 'invalid_grant', error_description: 'User not found' }, 400);
    }

    const issuer = getIssuer(c);
    const now = Math.floor(Date.now() / 1000);

    // Generate access token
    const accessToken = await sign({
      sub: user.id,
      iss: issuer,
      aud: client_id,
      exp: now + 3600, // 1 hour
      iat: now,
      scope: codeData.scope
    }, c.env.JWT_SECRET);

    // Generate ID token (OIDC specific)
    const idToken = await sign({
      sub: user.id,
      iss: issuer,
      aud: client_id,
      exp: now + 3600,
      iat: now,
      nonce: codeData.nonce,
      name: user.name,
      email: user.email,
      email_verified: user.email_verified === 1,
      picture: user.avatar_url
    }, c.env.JWT_SECRET);

    // Generate refresh token
    const refreshToken = generateId() + generateId();
    await c.env.SESSIONS.put(`oidc_refresh:${refreshToken}`, JSON.stringify({
      user_id: user.id,
      client_id,
      scope: codeData.scope,
      created_at: Date.now()
    }), { expirationTtl: 30 * 24 * 60 * 60 }); // 30 days

    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      id_token: idToken,
      scope: codeData.scope
    });

  } else if (grant_type === 'refresh_token') {
    const refresh_token = body.refresh_token as string;
    
    const storedRefresh = await c.env.SESSIONS.get(`oidc_refresh:${refresh_token}`);
    if (!storedRefresh) {
      return c.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
    }

    const refreshData = JSON.parse(storedRefresh);
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(refreshData.user_id).first<User>();

    if (!user) {
      return c.json({ error: 'invalid_grant', error_description: 'User not found' }, 400);
    }

    const issuer = getIssuer(c);
    const now = Math.floor(Date.now() / 1000);

    const accessToken = await sign({
      sub: user.id,
      iss: issuer,
      aud: refreshData.client_id,
      exp: now + 3600,
      iat: now,
      scope: refreshData.scope
    }, c.env.JWT_SECRET);

    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: refreshData.scope
    });
  }

  return c.json({ error: 'unsupported_grant_type' }, 400);
});

// ============================================
// UserInfo Endpoint
// ============================================
// Returns claims about the authenticated user

oidc.get('/userinfo', requireAuth, async (c) => {
  const user = c.get('user');
  
  return c.json({
    sub: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.email_verified === 1,
    picture: user.avatar_url,
    updated_at: Math.floor(new Date(user.updated_at || user.created_at).getTime() / 1000)
  });
});

// ============================================
// Token Revocation Endpoint
// ============================================

oidc.post('/revoke', async (c) => {
  const body = await c.req.parseBody();
  const token = body.token as string;
  const token_type_hint = body.token_type_hint as string;

  if (!token) {
    return c.json({ error: 'invalid_request' }, 400);
  }

  // Try to revoke as refresh token
  if (!token_type_hint || token_type_hint === 'refresh_token') {
    await c.env.SESSIONS.delete(`oidc_refresh:${token}`);
  }

  // Always return 200 per RFC 7009
  return c.json({ success: true });
});

// ============================================
// Introspection Endpoint
// ============================================
// Allows resource servers to validate tokens

oidc.post('/introspect', async (c) => {
  const body = await c.req.parseBody();
  const token = body.token as string;

  if (!token) {
    return c.json({ active: false });
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return c.json({ active: false });
    }

    return c.json({
      active: true,
      sub: payload.sub,
      client_id: payload.aud,
      scope: payload.scope,
      exp: payload.exp,
      iat: payload.iat,
      iss: payload.iss,
      token_type: 'Bearer'
    });
  } catch {
    return c.json({ active: false });
  }
});

// ============================================
// End Session (Logout) Endpoint
// ============================================

oidc.get('/logout', async (c) => {
  const { post_logout_redirect_uri, id_token_hint, state } = c.req.query();

  // Invalidate session if id_token_hint provided
  if (id_token_hint) {
    try {
      const payload = await verify(id_token_hint, c.env.JWT_SECRET);
      // Could invalidate user sessions here
    } catch {
      // Token invalid, continue with logout anyway
    }
  }

  if (post_logout_redirect_uri) {
    const redirectUrl = new URL(post_logout_redirect_uri);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    return c.redirect(redirectUrl.toString());
  }

  return c.json({ success: true, message: 'Logged out' });
});

// ============================================
// Client Registration Endpoint (Dynamic)
// ============================================
// Allows apps to register themselves (optional)

oidc.post('/register', async (c) => {
  const body = await c.req.json<{
    client_name: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    application_type?: string;
    contacts?: string[];
    logo_uri?: string;
    client_uri?: string;
    policy_uri?: string;
    tos_uri?: string;
  }>();

  if (!body.client_name || !body.redirect_uris?.length) {
    return c.json({ 
      error: 'invalid_client_metadata',
      error_description: 'client_name and redirect_uris are required'
    }, 400);
  }

  const clientId = generateId();
  const clientSecret = generateId() + generateId();

  await c.env.DB.prepare(`
    INSERT INTO oauth_clients (
      id, client_id, client_secret, name, redirect_uris, 
      grant_types, response_types, application_type, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
  `).bind(
    generateId(),
    clientId,
    clientSecret, // In production, hash this
    body.client_name,
    JSON.stringify(body.redirect_uris),
    JSON.stringify(body.grant_types || ['authorization_code']),
    JSON.stringify(body.response_types || ['code']),
    body.application_type || 'web'
  ).run();

  const issuer = getIssuer(c);

  return c.json({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name,
    redirect_uris: body.redirect_uris,
    grant_types: body.grant_types || ['authorization_code'],
    response_types: body.response_types || ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
    registration_access_token: clientSecret, // Simplified
    registration_client_uri: `${issuer}/api/oidc/register/${clientId}`
  }, 201);
});

export { oidc as oidcRoutes };
