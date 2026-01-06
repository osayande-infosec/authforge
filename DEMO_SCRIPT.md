# AuthForge Demo Script & LinkedIn Post

## � QUICK START - RUN THE DEMO

### Start Servers:
```bash
# Terminal 1 - Backend (from authforge folder)
cd authforge
npx wrangler dev --port 8787

# Terminal 2 - Frontend (from authforge/ui folder)
cd authforge/ui
npm run dev
```

### Open App:
- **Frontend**: http://localhost:3004
- **Backend**: http://localhost:8787

---

## 📱 Recommended: Use Loom

**Why Loom over OBS:**
- Instant shareable link (no upload needed)
- Built-in webcam bubble (professional look)
- Auto-generates transcript
- LinkedIn-friendly format
- Free for videos under 5 minutes

**Loom Setup:**
1. Download Loom: https://www.loom.com/download
2. Sign up (free tier is fine)
3. Click "New Video" → "Screen + Cam"
4. Select Chrome/Firefox window only (not full screen)
5. Position webcam bubble in bottom-left

---

## 🎬 VIDEO SCRIPT (3-4 minutes)

### INTRO (30 seconds)
```
[Show landing page: http://localhost:3004]

"Hey everyone! I built AuthForge - a self-hosted Auth0 alternative 
that runs entirely on Cloudflare's edge network.

Why does this matter? Companies pay $23,000+ per year for Auth0. 
AuthForge gives you the same features - Passkeys, OAuth, Magic Links, 
2FA, and an Encrypted Vault - for essentially free on Cloudflare's 
free tier.

Let me show you how it works."
```

### DEMO 1: REGISTRATION (45 seconds)
```
[Click "Get Started" or "Sign Up"]

"First, let's register a new account."

[Type email: demo@cyberguardng.ca]
[Type password: SecureDemo2025!]
[Click Register]

"That's it - account created. The password is hashed using PBKDF2 
with 100,000 iterations. Even if the database is compromised, 
passwords are safe."

[Show dashboard briefly]
```

### DEMO 2: PASSKEYS - REGISTRATION (45 seconds) ⭐ KEY FEATURE
```
[Navigate to Settings → Passkeys tab]

"Now here's the cool part - Passkeys. This is the future of 
authentication. No passwords to remember or steal."

[Click "Add Passkey"]
[Windows Hello / biometric prompt appears]

"I'm using Windows Hello - but this works with Face ID, Touch ID, 
or hardware security keys like YubiKey."

[Complete biometric authentication]
[Passkey appears in list]

"Done! The passkey is now registered with my device's secure enclave."
```

### DEMO 3: PASSKEYS - LOGIN (45 seconds) ⭐ KEY FEATURE
```
[Click Logout in top-right]
[Return to Login page]

"Now let me show you passwordless login in action."

[Click "Sign in with Passkey" button]
[Windows Hello / biometric prompt appears]

"Notice - no email, no password. Just biometrics."

[Complete biometric authentication]
[Dashboard appears]

"Boom - logged in! No password typed. This is WebAuthn - the same 
standard used by Google, Microsoft, and Apple. Phishing-resistant 
by design."
```

### DEMO 4: 2FA SETUP (45 seconds)
```
[Navigate to Settings → Security tab]
[Scroll to Two-Factor Authentication section]

"For accounts that still use passwords, let's enable 2FA."

[Click "Enable 2FA"]
[QR code appears in modal]

"This generates a TOTP secret - works with Google Authenticator, 
Microsoft Authenticator, Authy, or any TOTP app."

[Scan with phone and enter code]
[Show backup codes]

"I also get backup codes in case I lose my phone. Once enabled, 
every login requires both password AND the 6-digit code."
```

### DEMO 5: ENCRYPTED VAULT (60 seconds) ⭐ KEY FEATURE
```
[Navigate to Vault page]

"AuthForge also includes an encrypted vault - like 1Password 
or Bitwarden, but self-hosted."

[First time: Set Vault Password modal appears]

"First, I set a vault master password. This is used to derive an 
AES-256 encryption key using PBKDF2 with 100,000 iterations."

[Enter vault password and confirm]

[Click "+ Add Item" → "Password"]
[Fill in: 
  - Name: AWS Root Account
  - Website: aws.amazon.com
  - Username: admin@company.com
  - Password: super-secret-key
]
[Save]

"Watch this - the data you see is encrypted CLIENT-SIDE before 
it ever leaves the browser. The server only stores ciphertext."

[Click on the item to view details]

"I can decrypt and view it because I have the master password. 
Even I, as the server operator, can't read your secrets without 
your master password. True zero-knowledge architecture."
```

### DEMO 6: SESSIONS (20 seconds)
```
[Navigate to Settings → Sessions tab]

"You can also see all active sessions - where you're logged in, 
what device, what browser, when."

[Point to session list showing device details]

"And revoke any session with one click - essential for security 
if a device is lost or compromised."
```

### CLOSING (30 seconds)
```
[Show code briefly - VS Code with project structure]

"The entire backend is about 2,000 lines of TypeScript, running on 
Cloudflare Workers. Database is D1, sessions in KV - all serverless, 
all at the edge.

Key security features:
- WebAuthn passkeys with discoverable credentials
- Client-side AES-256-GCM encryption for the vault
- PBKDF2 key derivation with 100,000 iterations
- Rate limiting and comprehensive audit logging

The code is open source on GitHub - link in comments.

If you're building a SaaS and need authentication, or you're a 
security professional who wants full control over auth, check it out.

Thanks for watching!"
```

---

## 📝 LINKEDIN POST (Copy-Paste Ready)

### Option 1: Technical Focus
```
🔐 I built an Auth0 alternative that runs entirely on Cloudflare's edge.

AuthForge is a self-hosted authentication platform with:

✅ Passkeys (WebAuthn) - Passwordless biometric login
✅ OAuth 2.0 - Google & GitHub integration  
✅ Magic Links - Email-based authentication
✅ TOTP 2FA - With backup codes
✅ Encrypted Vault - Zero-knowledge password storage
✅ Session Management - Device tracking & revocation

Tech stack:
• Cloudflare Workers (edge runtime)
• Hono.js (fast web framework)
• D1 (serverless SQLite)
• KV (session storage)
• React + Tailwind (frontend)

Why build this?

Auth0 costs $23,000+/year for enterprise features.
AuthForge runs on Cloudflare's FREE tier.

Full source code: github.com/osayande-infosec/authforge

🎥 Watch the 3-minute demo [LOOM LINK]

#cybersecurity #authentication #cloudflare #webauthn #passkeys #opensource #infosec
```

### Option 2: Problem-Solution Focus
```
"Why are you building your own auth? Just use Auth0."

I hear this a lot. Here's why I built AuthForge:

❌ Auth0 enterprise: $23,000+/year
❌ Vendor lock-in
❌ Your user data on their servers
❌ Limited customization

✅ AuthForge: $0/month on Cloudflare free tier
✅ Full source code ownership
✅ Your data, your infrastructure
✅ Customize everything

Features I implemented:
🔑 Passkeys (WebAuthn) - The future of passwordless
🔗 OAuth (Google/GitHub)
✉️ Magic Links
📱 TOTP 2FA with backup codes
🔒 Encrypted Vault (zero-knowledge)
📊 Session management & audit logs

Built with Cloudflare Workers, Hono.js, D1, and React.

Watch me demo all features in 3 minutes: [LOOM LINK]

Code: github.com/osayande-infosec/authforge

Would you self-host your auth? Let me know 👇

#security #authentication #cloudflare #startup #saas
```

### Option 3: Career/Portfolio Focus
```
Adding another project to my security portfolio: AuthForge 🔐

A production-ready authentication platform I built from scratch:

Authentication:
→ Passkeys (WebAuthn biometrics)
→ OAuth 2.0 (Google, GitHub)
→ Magic Links
→ Email/Password with 2FA

Security:
→ PBKDF2 password hashing (100k iterations)
→ Rate limiting
→ Session management
→ Comprehensive audit logging

Bonus - Encrypted Vault:
→ Zero-knowledge encryption
→ Store passwords, notes, cards
→ Client-side AES-256

Stack: Cloudflare Workers • Hono.js • D1 • KV • React • Tailwind

This joins my portfolio alongside:
• SAML SSO Implementation
• OWASP Security Audit
• [Your other projects]

3-minute demo: [LOOM LINK]
Source code: github.com/osayande-infosec/authforge

Building in public - more projects coming soon.

#cybersecurity #portfolio #cloudflare #webauthn #infosec
```

---

## 🎥 PRE-RECORDING CHECKLIST

### Before Recording:
- [ ] Close unnecessary browser tabs
- [ ] Clear browser history/autofill (privacy)
- [ ] Dark mode ON (easier on eyes in video)
- [ ] Font size increased in browser (Ctrl + +)
- [ ] Notifications OFF (Do Not Disturb)
- [ ] Backend running: `npx wrangler dev`
- [ ] Frontend running: `cd ui && npm run dev`
- [ ] Test all features work before recording

### Loom Settings:
- [ ] Microphone: Select correct mic
- [ ] Camera: ON, bottom-left position
- [ ] Recording: Current Tab only (not full screen)
- [ ] HD quality enabled

### During Recording:
- [ ] Speak slowly and clearly
- [ ] Pause briefly between sections
- [ ] Move mouse smoothly (not frantically)
- [ ] If you make a mistake, pause and re-do that section
- [ ] Loom lets you trim later!

---

## 📤 POSTING STRATEGY

### Best Times to Post on LinkedIn:
- **Tuesday-Thursday**: 8-10 AM or 12 PM
- **Avoid**: Weekends, Monday morning, Friday afternoon

### Post Workflow:
1. Record Loom video
2. Copy Loom link
3. Post on LinkedIn with video link
4. Add link to GitHub in first comment
5. Engage with comments for first hour

### Hashtags (pick 5-8):
```
#cybersecurity #authentication #cloudflare #webauthn 
#passkeys #opensource #infosec #security #programming 
#typescript #react #serverless #portfolio
```

---

## 🔗 LINKS TO INCLUDE

- GitHub: https://github.com/osayande-infosec/authforge
- Loom video: [Your recorded link]
- LinkedIn: [Your profile]
- CyberGuardNG: https://cyberguardng.ca

Good luck with the recording! 🎬
