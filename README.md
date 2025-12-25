# AuthForge

> **Self-hosted Auth0 Alternative** - Passkeys, OAuth, Magic Links & Encrypted Vault

A modern, privacy-first authentication platform built on Cloudflare's edge infrastructure. Zero vendor lock-in, full data ownership.

## 🚀 Features

### 🔐 Authentication Methods
- **Passkeys (WebAuthn)** - Passwordless biometric authentication
- **OAuth 2.0** - Google & GitHub social login
- **Magic Links** - Email-based passwordless login
- **Email/Password** - Traditional authentication with bcrypt hashing
- **TOTP 2FA** - Time-based one-time passwords with backup codes

### 🔒 Security
- **End-to-end encryption** for vault items
- **PBKDF2 password hashing** with 100k iterations
- **Rate limiting** on all endpoints
- **Comprehensive audit logging**
- **Session management** with device tracking
- **Secure HTTP-only cookies**

### 📦 Encrypted Vault
- Store passwords, notes, cards, and identities
- Client-side encryption (zero-knowledge)
- Folder organization
- Import/Export functionality

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Cloudflare Workers |
| **Framework** | Hono.js |
| **Database** | Cloudflare D1 (SQLite) |
| **Sessions** | Cloudflare KV |
| **Frontend** | React + Vite + Tailwind CSS |
| **Passkeys** | @simplewebauthn/server |
| **JWT** | jose |
| **2FA** | otpauth |

## 📋 API Endpoints

### Authentication
```
POST /auth/register        - Register with email/password
POST /auth/login           - Login with email/password
POST /auth/login/2fa       - Complete 2FA verification
POST /auth/magic-link      - Request magic link
GET  /auth/magic-link/verify - Verify magic link
POST /auth/logout          - Logout current session
POST /auth/2fa/setup       - Setup TOTP 2FA
POST /auth/2fa/verify      - Enable 2FA
POST /auth/2fa/disable     - Disable 2FA
```

### Passkeys
```
POST /passkeys/register/start    - Start passkey registration
POST /passkeys/register/complete - Complete passkey registration
POST /passkeys/authenticate/start    - Start passkey login
POST /passkeys/authenticate/complete - Complete passkey login
GET  /passkeys              - List user passkeys
PATCH /passkeys/:id         - Rename passkey
DELETE /passkeys/:id        - Delete passkey
```

### OAuth
```
GET  /oauth/:provider/authorize - Get OAuth URL
GET  /oauth/google/callback     - Google callback
GET  /oauth/github/callback     - GitHub callback
GET  /oauth/accounts            - List linked accounts
DELETE /oauth/accounts/:id      - Unlink account
```

### Sessions
```
GET  /sessions          - List all sessions
GET  /sessions/current  - Get current session
DELETE /sessions/:id    - Revoke session
POST /sessions/revoke-all - Revoke all other sessions
```

### Vault
```
GET  /vault/status      - Check vault status
POST /vault/key         - Set vault encryption key
GET  /vault/items       - List vault items
POST /vault/items       - Create vault item
GET  /vault/items/:id   - Get vault item
PUT  /vault/items/:id   - Update vault item
DELETE /vault/items/:id - Delete vault item
GET  /vault/folders     - List folders
POST /vault/folders     - Create folder
GET  /vault/export      - Export vault
POST /vault/import      - Import vault
```

### Users
```
GET  /users/me              - Get current user
PATCH /users/me             - Update profile
POST /users/me/email        - Change email
POST /users/me/password     - Change password
POST /users/password-reset  - Request password reset
GET  /users/me/audit-log    - Get audit log
DELETE /users/me            - Delete account
```

## 🔧 Setup

### Prerequisites
- Node.js 18+
- Cloudflare account (free tier works!)
- Wrangler CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/osayande-infosec/authforge.git
cd authforge

# Install dependencies
npm install

# Create D1 database
npx wrangler d1 create authforge-db

# Create KV namespace
npx wrangler kv:namespace create SESSIONS

# Update wrangler.toml with your IDs

# Initialize database
npx wrangler d1 execute authforge-db --file=schema.sql

# Run locally
npm run dev

# Deploy
npm run deploy
```

### Environment Variables

```toml
# wrangler.toml
[vars]
WEBAUTHN_RP_ID = "yourdomain.com"
WEBAUTHN_RP_NAME = "AuthForge"
WEBAUTHN_ORIGIN = "https://yourdomain.com"
JWT_SECRET = "your-secret-key"

# Secrets (set via wrangler secret put)
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET
# GITHUB_CLIENT_ID
# GITHUB_CLIENT_SECRET
```

## 📁 Project Structure

```
authforge/
├── src/
│   ├── index.ts          # Main Hono app
│   ├── types.ts          # TypeScript interfaces
│   ├── lib/
│   │   ├── utils.ts      # Password hashing, JWT, etc.
│   │   └── middleware.ts # Auth middleware
│   └── routes/
│       ├── auth.ts       # Email/password, magic links, 2FA
│       ├── passkeys.ts   # WebAuthn registration/auth
│       ├── oauth.ts      # Google & GitHub OAuth
│       ├── sessions.ts   # Session management
│       ├── vault.ts      # Encrypted vault
│       └── users.ts      # Profile, audit log
├── ui/                   # React frontend
├── schema.sql            # D1 database schema
├── wrangler.toml         # Cloudflare config
└── package.json
```

## 🛡️ Security Considerations

- All passwords hashed with PBKDF2 (100k iterations)
- Session tokens hashed before storage
- Rate limiting prevents brute force attacks
- Vault items encrypted client-side
- Comprehensive audit logging
- CORS properly configured
- Secure cookie settings

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

## 📧 Contact

- **GitHub**: [@osayande-infosec](https://github.com/osayande-infosec)
- **Project**: [github.com/osayande-infosec/authforge](https://github.com/osayande-infosec/authforge)

---

**AuthForge** - Own your authentication. 🔐
