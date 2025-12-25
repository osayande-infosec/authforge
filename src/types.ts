// AuthForge Type Definitions

export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  SESSIONS: KVNamespace;
  RATE_LIMIT: KVNamespace;

  // Environment variables
  JWT_SECRET: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_RP_NAME: string;
  ALLOWED_ORIGINS: string;
  ENVIRONMENT?: string;

  // OAuth
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  // Email
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
}

export interface User {
  id: string;
  email: string;
  email_verified: number;
  name: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  totp_secret: string | null;
  totp_enabled: number;
  backup_codes: string | null;
  vault_key: string | null;
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  device_name: string | null;
  location: string | null;
  expires_at: string;
  created_at: string;
  last_active_at: string;
}

export interface Passkey {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string | null;
  backed_up: number;
  transports: string | null;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

export interface VaultItem {
  id: string;
  user_id: string;
  type: 'password' | 'note' | 'card' | 'identity';
  name: string;
  encrypted_data: string;
  iv: string;
  favorite: number;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  created_at: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// JWT Payload
export interface JWTPayload {
  sub: string; // user_id
  email: string;
  name?: string;
  iat: number;
  exp: number;
  jti: string; // unique token id
}

// Auth context added to requests
export interface AuthContext {
  user: User;
  session: Session;
}
