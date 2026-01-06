# AuthForge Demo Script - OBS Text-Based Recording

## 🖥️ SERVER STATUS
- **Backend**: http://localhost:8787 ✅
- **Frontend**: http://localhost:3005 ✅

---

## 🎬 OBS RECORDING SETUP

### OBS Settings:
1. **Resolution**: 1920x1080 (or 1280x720 for smaller file)
2. **FPS**: 30
3. **Output Format**: MP4 (for easy editing/uploading)
4. **Audio**: None needed for text-based demo
5. **Source**: Window Capture → Select browser window

### Browser Setup:
1. Open Chrome/Edge in **Incognito Mode** (clean state)
2. Set zoom to **110-125%** for better visibility
3. Open DevTools → Network tab (optional, shows API calls)
4. Navigate to: **http://localhost:3005**

---

## 📝 TEXT OVERLAYS FOR OBS

Create these as **Text (GDI+)** sources in OBS. Show/hide them during recording.

### Overlay 1: INTRO
```
🔐 AuthForge Demo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Self-Hosted Auth0 Alternative
Passkeys • OAuth • 2FA • Encrypted Vault

Built with: Cloudflare Workers + Hono.js + D1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overlay 2: REGISTRATION
```
📝 User Registration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Email validation
✓ Password hashed with PBKDF2 (100k iterations)
✓ Automatic session creation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overlay 3: PASSKEY REGISTRATION
```
🔑 Passkey Registration (WebAuthn)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Uses device biometrics (Windows Hello/Touch ID)
✓ Public key cryptography - no shared secrets
✓ Phishing resistant by design
✓ Works with hardware keys (YubiKey)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overlay 4: PASSKEY LOGIN
```
🚀 Passwordless Login with Passkey
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ No password needed
✓ Biometric verification only
✓ Same standard used by Google, Apple, Microsoft
✓ Discoverable credentials (no username needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overlay 5: 2FA SETUP
```
📱 Two-Factor Authentication (TOTP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ RFC 6238 compliant TOTP
✓ Works with Google/Microsoft Authenticator
✓ Backup codes for recovery
✓ 30-second rotating codes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overlay 6: ENCRYPTED VAULT
```
🔒 Zero-Knowledge Encrypted Vault
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Client-side AES-256-GCM encryption
✓ PBKDF2 key derivation (100k iterations)
✓ Server never sees plaintext data
✓ Master password never leaves browser
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overlay 7: SESSIONS
```
📊 Session Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ View all active sessions
✓ Device/browser detection
✓ One-click session revocation
✓ Cloudflare KV for fast session lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overlay 8: TECH STACK
```
⚡ Tech Stack
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:  Cloudflare Workers + Hono.js
Database: Cloudflare D1 (SQLite)
Sessions: Cloudflare KV
Frontend: React + Vite + Tailwind CSS
Auth:     @simplewebauthn/server v10

Cost: $0/month on Cloudflare Free Tier
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overlay 9: CLOSING
```
🎯 AuthForge - Key Features
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Passkeys (WebAuthn)    ✅ OAuth 2.0
✅ Magic Links            ✅ TOTP 2FA
✅ Encrypted Vault        ✅ Session Management
✅ Rate Limiting          ✅ Audit Logging

GitHub: github.com/[your-username]/authforge
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎬 RECORDING SEQUENCE (Step-by-Step)

### Scene 1: INTRO (5 seconds)
**Overlay**: Show Overlay 1 (INTRO)
**Browser**: Landing page at http://localhost:3005

---

### Scene 2: REGISTRATION (15 seconds)
**Overlay**: Show Overlay 2 (REGISTRATION)
**Actions**:
1. Click "Get Started" button
2. Enter email: `demo@authforge.dev`
3. Enter password: `SecureDemo2025!`
4. Click "Create Account"
5. Wait for dashboard to appear

---

### Scene 3: PASSKEY REGISTRATION (20 seconds)
**Overlay**: Show Overlay 3 (PASSKEY REGISTRATION)
**Actions**:
1. Click "Settings" in sidebar
2. Click "Passkeys" tab
3. Click "Add Passkey"
4. Complete Windows Hello prompt
5. See passkey appear in list

---

### Scene 4: LOGOUT (5 seconds)
**Overlay**: Remove overlay (no text)
**Actions**:
1. Click user menu (top right)
2. Click "Logout"

---

### Scene 5: PASSKEY LOGIN (15 seconds)
**Overlay**: Show Overlay 4 (PASSKEY LOGIN)
**Actions**:
1. On login page, click "Sign in with Passkey"
2. Complete Windows Hello prompt
3. Instantly logged in - no password!

---

### Scene 6: 2FA SETUP (20 seconds)
**Overlay**: Show Overlay 5 (2FA SETUP)
**Actions**:
1. Go to Settings → Security tab
2. Click "Enable 2FA"
3. Show QR code (blur if sensitive)
4. Enter TOTP code from authenticator app
5. Show backup codes

---

### Scene 7: ENCRYPTED VAULT (25 seconds)
**Overlay**: Show Overlay 6 (ENCRYPTED VAULT)
**Actions**:
1. Click "Vault" in sidebar
2. Set vault master password (first time only)
3. Click "Add Item" → "Password"
4. Fill in sample data:
   - Name: `AWS Root Account`
   - Website: `aws.amazon.com`
   - Username: `admin@company.com`
   - Password: `super-secret-key-123`
5. Click Save
6. Click item to view decrypted content

---

### Scene 8: SESSIONS (10 seconds)
**Overlay**: Show Overlay 7 (SESSIONS)
**Actions**:
1. Go to Settings → Sessions tab
2. Show current session with device info
3. Hover over revoke button (optional)

---

### Scene 9: CLOSING (10 seconds)
**Overlay**: Show Overlay 8 (TECH STACK) for 5 seconds
**Then**: Show Overlay 9 (CLOSING) for 5 seconds
**Browser**: Stay on any page, overlay is the focus

---

## ⏱️ TOTAL RUNTIME: ~2 minutes

---

## 🎨 OBS TEXT STYLING RECOMMENDATIONS

### Font Settings:
- **Font**: Consolas, JetBrains Mono, or Fira Code
- **Size**: 36-48px (adjust for your resolution)
- **Color**: `#00FF00` (green) or `#FFFFFF` (white)
- **Outline**: 2px black outline for readability

### Background Settings:
- **Background**: `#000000` (black)
- **Opacity**: 70-80%
- **Padding**: 20px on all sides

### Position:
- **Location**: Bottom of screen (lower third)
- **Safe Area**: Keep 10% margin from edges

---

## 📋 PRE-RECORDING CHECKLIST

Before you hit record:

- [ ] Both servers running (backend:8787, frontend:3005)
- [ ] Browser in Incognito mode
- [ ] Browser zoom at 110-125%
- [ ] All OBS text overlays created
- [ ] Test Windows Hello is working
- [ ] Close unnecessary browser tabs
- [ ] Disable system notifications
- [ ] Test recording for 10 seconds first

---

## 🎥 POST-RECORDING CHECKLIST

After recording:

- [ ] Review footage for mistakes
- [ ] Trim start/end as needed
- [ ] Check text overlays are readable
- [ ] Export as MP4 (H.264, 1080p)
- [ ] Test playback before uploading
- [ ] Prepare LinkedIn post text

---

## 📱 LINKEDIN POST TEMPLATE

```
🔐 Built my own Auth0 alternative - runs on Cloudflare's free tier!

AuthForge is a self-hosted authentication platform with:

✅ Passkeys (WebAuthn) - Passwordless biometric login
✅ TOTP 2FA - Works with any authenticator app
✅ Encrypted Vault - Zero-knowledge password storage
✅ Session Management - Track & revoke sessions

Tech stack:
• Cloudflare Workers (edge runtime)
• Hono.js (fast web framework)
• D1 (serverless SQLite)
• React + Tailwind (frontend)

Why build this?
Auth0 costs $23,000+/year for enterprise features.
AuthForge runs on Cloudflare's FREE tier.

Watch the 2-minute demo 👇

#cybersecurity #authentication #cloudflare #webauthn #passkeys #opensource
```

---

## 🔗 QUICK LINKS

- **Frontend**: http://localhost:3005
- **Backend**: http://localhost:8787
- **API Test**: http://localhost:8787/api/health
