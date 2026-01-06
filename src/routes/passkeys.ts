// AuthForge - Passkey (WebAuthn) Routes

import { Hono } from 'hono';
import { Env, Passkey, User } from '../types';
import { 
  generateId, 
  generateToken,
  sha256,
  createSession,
  logAudit 
} from '../lib/utils';
import { requireAuth, rateLimit } from '../lib/middleware';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/types';

const passkeys = new Hono<{ Bindings: Env }>();

// Get RP config - origin must match where the frontend runs
const getRP = (env: Env, requestOrigin?: string) => {
  // Use the request origin for verification (frontend origin), or fall back to config
  const origin = requestOrigin || env.WEBAUTHN_ORIGIN || 'http://localhost:3004';
  return {
    rpID: env.WEBAUTHN_RP_ID || 'localhost',
    rpName: env.WEBAUTHN_RP_NAME || 'AuthForge',
    origin
  };
};

// Start passkey registration (authenticated users)
passkeys.post('/register/start', requireAuth, async (c) => {
  const user = c.get('user');
  const requestOrigin = c.req.header('origin');
  const rp = getRP(c.env, requestOrigin);

  // Get existing passkeys
  const existingPasskeys = await c.env.DB.prepare(
    'SELECT credential_id FROM passkeys WHERE user_id = ?'
  ).bind(user.id).all<{ credential_id: string }>();

  const excludeCredentials = existingPasskeys.results.map(pk => ({
    id: pk.credential_id,
    type: 'public-key' as const
  }));

  const options = await generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform'
    }
  });

  // Store challenge
  const challengeId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO webauthn_challenges (id, user_id, challenge, type, expires_at)
    VALUES (?, ?, ?, 'register', datetime('now', '+5 minutes'))
  `).bind(challengeId, user.id, options.challenge).run();

  return c.json({
    success: true,
    challengeId,
    options
  });
});

// Complete passkey registration
passkeys.post('/register/complete', requireAuth, async (c) => {
  const user = c.get('user');
  const requestOrigin = c.req.header('origin');
  const rp = getRP(c.env, requestOrigin);
  
  const body = await c.req.json<{
    challengeId: string;
    credential: RegistrationResponseJSON;
    name?: string;
  }>();
  const { challengeId, credential, name } = body;

  if (!challengeId || !credential) {
    return c.json({ error: 'Challenge ID and credential are required' }, 400);
  }

  // Get and validate challenge
  const challenge = await c.env.DB.prepare(`
    SELECT * FROM webauthn_challenges 
    WHERE id = ? AND user_id = ? AND type = 'register' AND expires_at > datetime('now')
  `).bind(challengeId, user.id).first<{ challenge: string }>();

  if (!challenge) {
    return c.json({ error: 'Invalid or expired challenge' }, 401);
  }

  // Verify registration
  let verification: VerifiedRegistrationResponse;
  try {
    console.log('Verifying with:', { expectedOrigin: rp.origin, expectedRPID: rp.rpID, challenge: challenge.challenge.substring(0, 20) + '...' });
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID
    });
  } catch (error) {
    console.error('Passkey verification error:', error);
    await logAudit(c.env.DB, 'passkey.register.failed', user.id, c.req.raw, { error: String(error) });
    return c.json({ error: `Failed to verify passkey: ${String(error)}` }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: 'Passkey verification failed' }, 400);
  }

  // Log the structure to debug
  console.log('Registration info keys:', Object.keys(verification.registrationInfo));
  console.log('Registration info:', JSON.stringify(verification.registrationInfo, (key, value) => 
    value instanceof Uint8Array ? `Uint8Array(${value.length})` : value
  , 2));

  const { registrationInfo } = verification;
  
  // In v10+, the credential is directly in registrationInfo
  const credentialId = registrationInfo.credential?.id || registrationInfo.credentialID;
  const credentialPublicKey = registrationInfo.credential?.publicKey || registrationInfo.credentialPublicKey;
  const counter = registrationInfo.credential?.counter ?? registrationInfo.counter ?? 0;
  const credentialDeviceType = registrationInfo.credentialDeviceType;
  const credentialBackedUp = registrationInfo.credentialBackedUp;

  if (!credentialId || !credentialPublicKey) {
    console.error('Missing credential data:', { credentialId, credentialPublicKey });
    return c.json({ error: 'Invalid credential data from authenticator' }, 400);
  }

  // Check if credential already exists
  const credentialIdBase64 = typeof credentialId === 'string' 
    ? credentialId 
    : Buffer.from(credentialId).toString('base64url');
    
  const existing = await c.env.DB.prepare(
    'SELECT id FROM passkeys WHERE credential_id = ?'
  ).bind(credentialIdBase64).first();

  if (existing) {
    return c.json({ error: 'This passkey is already registered' }, 409);
  }

  // Store passkey
  const passkeyId = generateId();
  const publicKeyBase64 = credentialPublicKey instanceof Uint8Array
    ? Buffer.from(credentialPublicKey).toString('base64')
    : Buffer.from(credentialPublicKey).toString('base64');
    
  await c.env.DB.prepare(`
    INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, device_type, backed_up, transports, name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    passkeyId,
    user.id,
    credentialIdBase64,
    publicKeyBase64,
    counter,
    credentialDeviceType,
    credentialBackedUp ? 1 : 0,
    credential.response.transports?.join(',') || null,
    name || `Passkey ${new Date().toLocaleDateString()}`
  ).run();

  // Delete challenge
  await c.env.DB.prepare('DELETE FROM webauthn_challenges WHERE id = ?')
    .bind(challengeId)
    .run();

  await logAudit(c.env.DB, 'passkey.registered', user.id, c.req.raw, { passkeyId });

  return c.json({
    success: true,
    message: 'Passkey registered successfully',
    passkey: {
      id: passkeyId,
      name: name || `Passkey ${new Date().toLocaleDateString()}`,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp
    }
  });
});

// Start passkey authentication (unauthenticated - for login)
passkeys.post('/authenticate/start', rateLimit(10, 300), async (c) => {
  const requestOrigin = c.req.header('origin');
  const rp = getRP(c.env, requestOrigin);
  const body = await c.req.json<{ email?: string }>();

  let allowCredentials: { id: string; type: 'public-key' }[] = [];
  let userId: string | null = null;

  // If email provided, get credentials for that user
  if (body.email) {
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(body.email.toLowerCase())
      .first<{ id: string }>();

    if (user) {
      userId = user.id;
      const userPasskeys = await c.env.DB.prepare(
        'SELECT credential_id, transports FROM passkeys WHERE user_id = ?'
      ).bind(user.id).all<{ credential_id: string; transports: string | null }>();

      allowCredentials = userPasskeys.results.map(pk => ({
        id: pk.credential_id,
        type: 'public-key' as const
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    userVerification: 'preferred'
  });

  // Store challenge
  const challengeId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO webauthn_challenges (id, user_id, challenge, type, expires_at)
    VALUES (?, ?, ?, 'authenticate', datetime('now', '+5 minutes'))
  `).bind(challengeId, userId, options.challenge).run();

  return c.json({
    success: true,
    challengeId,
    options
  });
});

// Complete passkey authentication
passkeys.post('/authenticate/complete', rateLimit(10, 300), async (c) => {
  const requestOrigin = c.req.header('origin');
  const rp = getRP(c.env, requestOrigin);
  
  const body = await c.req.json<{
    challengeId: string;
    credential: AuthenticationResponseJSON;
  }>();
  const { challengeId, credential } = body;

  console.log('Auth complete - credential received:', JSON.stringify(credential, null, 2));

  if (!challengeId || !credential) {
    return c.json({ error: 'Challenge ID and credential are required' }, 400);
  }

  if (!credential.id) {
    return c.json({ error: 'Credential ID is missing' }, 400);
  }

  // Get challenge
  const challenge = await c.env.DB.prepare(`
    SELECT * FROM webauthn_challenges 
    WHERE id = ? AND type = 'authenticate' AND expires_at > datetime('now')
  `).bind(challengeId).first<{ id: string; user_id: string | null; challenge: string }>();

  if (!challenge) {
    return c.json({ error: 'Invalid or expired challenge' }, 401);
  }

  // Find passkey by credential ID
  const credentialIdB64 = credential.id;
  console.log('Looking up passkey with credential_id:', credentialIdB64);
  
  const passkey = await c.env.DB.prepare(
    'SELECT * FROM passkeys WHERE credential_id = ?'
  ).bind(credentialIdB64).first<Passkey>();

  console.log('Found passkey:', passkey ? 'yes' : 'no');

  if (!passkey) {
    await logAudit(c.env.DB, 'passkey.auth.failed', null, c.req.raw, { reason: 'not_found', credentialId: credentialIdB64 });
    return c.json({ error: 'Passkey not found' }, 401);
  }

  // Get user
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(passkey.user_id)
    .first<User>();

  if (!user || user.status !== 'active') {
    return c.json({ error: 'User not found or inactive' }, 401);
  }

  // Verify authentication - convert base64 public key to Uint8Array
  let verification: VerifiedAuthenticationResponse;
  try {
    // Decode base64 public key to Uint8Array
    const publicKeyBytes = Uint8Array.from(atob(passkey.public_key), c => c.charCodeAt(0));
    
    console.log('Verifying with:', {
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      credentialId: passkey.credential_id,
      counter: passkey.counter
    });

    // v10 API uses 'authenticator' not 'credential'
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      authenticator: {
        credentialID: passkey.credential_id,
        credentialPublicKey: publicKeyBytes,
        counter: passkey.counter
      }
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    await logAudit(c.env.DB, 'passkey.auth.failed', user.id, c.req.raw, { error: String(error) });
    return c.json({ error: 'Failed to verify passkey authentication' }, 400);
  }

  if (!verification.verified) {
    return c.json({ error: 'Passkey verification failed' }, 401);
  }

  // Update counter
  await c.env.DB.prepare(`
    UPDATE passkeys SET counter = ?, last_used_at = datetime('now') WHERE id = ?
  `).bind(verification.authenticationInfo.newCounter, passkey.id).run();

  // Delete challenge
  await c.env.DB.prepare('DELETE FROM webauthn_challenges WHERE id = ?')
    .bind(challengeId)
    .run();

  // Create session
  const { session, token } = await createSession(c.env.DB, c.env.SESSIONS, user, c.req.raw);

  // Mark 2FA as verified (passkeys are 2FA)
  if (user.totp_enabled) {
    await c.env.SESSIONS.put(`2fa:${session.id}`, '1', { expirationTtl: 7 * 24 * 60 * 60 });
  }

  await logAudit(c.env.DB, 'passkey.authenticated', user.id, c.req.raw, { passkeyId: passkey.id });

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

// List user's passkeys
passkeys.get('/', requireAuth, async (c) => {
  const user = c.get('user');

  const result = await c.env.DB.prepare(`
    SELECT id, name, device_type, backed_up, last_used_at, created_at
    FROM passkeys WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(user.id).all<Passkey>();

  return c.json({
    success: true,
    passkeys: result.results.map(pk => ({
      id: pk.id,
      name: pk.name,
      deviceType: pk.device_type,
      backedUp: pk.backed_up === 1,
      lastUsedAt: pk.last_used_at,
      createdAt: pk.created_at
    }))
  });
});

// Rename passkey
passkeys.patch('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const passkeyId = c.req.param('id');
  const body = await c.req.json<{ name: string }>();

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const result = await c.env.DB.prepare(`
    UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ?
  `).bind(body.name, passkeyId, user.id).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Passkey not found' }, 404);
  }

  return c.json({ success: true, message: 'Passkey renamed' });
});

// Delete passkey
passkeys.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const passkeyId = c.req.param('id');

  // Check if user has other auth methods
  const passkeysCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM passkeys WHERE user_id = ?'
  ).bind(user.id).first<{ count: number }>();

  const hasPassword = user.password_hash !== null;

  if ((passkeysCount?.count || 0) <= 1 && !hasPassword) {
    return c.json({ 
      error: 'Cannot delete your only passkey without a password set' 
    }, 400);
  }

  const result = await c.env.DB.prepare(
    'DELETE FROM passkeys WHERE id = ? AND user_id = ?'
  ).bind(passkeyId, user.id).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Passkey not found' }, 404);
  }

  await logAudit(c.env.DB, 'passkey.deleted', user.id, c.req.raw, { passkeyId });

  return c.json({ success: true, message: 'Passkey deleted' });
});

export { passkeys as passkeysRoutes };
